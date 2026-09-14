"""Start an HTTP server on :4173, then run unittest discovery in this directory."""
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

class AquariumTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(args=['--no-sandbox','--enable-unsafe-swiftshader'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1440,'height':1000})
        self.page=self.context.new_page(); self.errors=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
    def tearDown(self): self.context.close()
    def open(self):
        self.page.goto('http://127.0.0.1:4173')
        expect(self.page.locator('body')).to_have_attribute('data-ready','true',timeout=10000)
    def test_scene_and_controls(self):
        self.open()
        expect(self.page.locator('.resident')).to_have_count(3)
        expect(self.page.locator('#aquarium canvas')).to_be_visible()
        self.page.locator('#pause').click()
        expect(self.page.locator('#pause')).to_have_attribute('aria-pressed','true')
        self.page.locator('#pause').click(); self.page.locator('#feed').click()
        expect(self.page.locator('#toast')).to_contain_text('먹이')
        self.page.locator('#night').click()
        expect(self.page.locator('#night')).to_have_attribute('aria-pressed','true')
        self.page.locator('#speed').fill('1.5')
        expect(self.page.locator('#speed-value')).to_have_text('1.5×')
        self.page.screenshot(path='/tmp/aquarium-desktop.png')
        self.assertEqual(self.errors,[])
    def test_edit_upload_remove_and_reload(self):
        self.open(); self.page.locator('.resident').first.click()
        self.page.locator('#fish-name').fill('나의 물고기'); self.page.locator('#crop-zoom').fill('2')
        self.page.locator('#save-fish').click()
        expect(self.page.locator('.resident').first).to_contain_text('나의 물고기')
        self.page.reload(); expect(self.page.locator('.resident').first).to_contain_text('나의 물고기')
        self.page.locator('#photo-input').set_input_files(str(next(Path('.').glob('*.jpeg'))))
        expect(self.page.locator('#fish-dialog')).to_be_visible()
        self.page.locator('#fish-name').fill('새 친구'); self.page.locator('#save-fish').click()
        expect(self.page.locator('.resident')).to_have_count(4)
        self.page.locator('.resident').last.click(); self.page.locator('#remove-fish').click()
        expect(self.page.locator('.resident')).to_have_count(3)
        self.assertEqual(self.errors,[])
    def test_mobile_layout_and_reduced_motion(self):
        self.page.set_viewport_size({'width':390,'height':844}); self.page.emulate_media(reduced_motion='reduce')
        self.open(); expect(self.page.locator('#pause')).to_have_attribute('aria-pressed','true')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))
        self.page.locator('.resident').first.click()
        expect(self.page.locator('#save-fish')).to_be_in_viewport()
        self.page.screenshot(path='/tmp/aquarium-mobile.png'); self.page.keyboard.press('Escape')
        expect(self.page.locator('#fish-dialog')).not_to_be_visible()
    def test_initial_scene_and_swimming_bounds(self):
        self.open()
        result=self.page.evaluate("""async()=>{
          const {Aquarium}=await import('./js/aquarium.js');
          const {DEFAULT_FISH,portraitCanvas}=await import('./js/portraits.js');
          const host=document.createElement('div');host.style.cssText='width:600px;height:400px';document.body.append(host);
          const scene=new Aquarium(host,{reducedMotion:true});scene.renderer.setAnimationLoop(null);
          const records=Array.from({length:12},(_,i)=>({...DEFAULT_FISH[i%3],id:String(i)}));
          scene.setFish(records,await Promise.all(records.map(portraitCanvas)));
          const within=()=>scene.fish.every(({mesh})=>Number.isFinite(mesh.position.x)&&Math.abs(mesh.position.x)<=9.5&&mesh.position.y>=-3&&mesh.position.y<=3.7&&Math.abs(mesh.position.z)<=3.7);
          const initialBounds=within(),schoolSpread=scene.school.some(f=>f.mesh.position.length()>1);
          const start=scene.fish.map(f=>f.mesh.position.clone());let bounds=true;
          for(let i=0;i<2400;i++){scene.update(1/60);bounds&&=within();}
          const moved=scene.fish.every((f,i)=>f.mesh.position.distanceTo(start[i])>.2);
          scene.feed();const count=scene.food.length;scene.feed();const limited=scene.food.length===count;
          const pellet=scene.food[0];scene.fish[0].mesh.position.copy(pellet.mesh.position);scene.update(.016);const eaten=!scene.food.includes(pellet);
          for(let i=0;i<1200;i++)scene.update(1/60);
          const cleared=scene.food.length===0;
          scene.observer.disconnect();scene.controls.dispose();scene.renderer.dispose();host.remove();
          return {initialBounds,schoolSpread,bounds,moved,limited,eaten,cleared};
        }""")
        self.assertTrue(all(result.values()),result)
    def test_unavailable_storage_and_bad_photo(self):
        self.page.add_init_script("Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')}")
        self.open(); self.page.locator('.resident').first.click()
        self.page.locator('#fish-name').fill('저장 테스트'); self.page.locator('#save-fish').click()
        expect(self.page.locator('.resident').first).to_contain_text('저장 테스트')
        expect(self.page.locator('#toast')).to_contain_text('이번 방문에만')
        self.page.locator('#photo-input').set_input_files({'name':'bad.png','mimeType':'image/png','buffer':b'not an image'})
        expect(self.page.locator('#toast')).to_contain_text('사진을 읽을 수 없어요')
        expect(self.page.locator('.resident')).to_have_count(3)
        self.assertEqual(self.errors,[])
    def test_replacing_photo_preserves_name_and_color(self):
        self.open(); self.page.locator('.resident').first.click()
        self.page.locator('#fish-name').fill('바꾼 이름'); self.page.locator('#fish-color').fill('#abcdef')
        self.page.locator('#crop-zoom').fill('2')
        with self.page.expect_file_chooser() as chooser:
            self.page.locator('#replace-photo').click()
        chooser.value.set_files(str(next(Path('.').glob('*.jpeg'))))
        expect(self.page.locator('#crop-zoom')).to_have_value('1')
        expect(self.page.locator('#fish-name')).to_have_value('바꾼 이름')
        expect(self.page.locator('#fish-color')).to_have_value('#abcdef')
        self.page.locator('#save-fish').click()
        expect(self.page.locator('.resident').first).to_contain_text('바꾼 이름')
    def test_reopen_editor_clears_validation_error(self):
        self.open(); self.page.locator('.resident').first.click()
        self.page.locator('#fish-name').fill('   '); self.page.locator('#save-fish').click()
        self.assertFalse(self.page.locator('#fish-name').evaluate('(el)=>el.checkValidity()'))
        self.page.locator('#close-dialog').click(); self.page.locator('.resident').last.click()
        self.assertTrue(self.page.locator('#fish-name').evaluate('(el)=>el.checkValidity()'))
        self.page.locator('#save-fish').click()
        expect(self.page.locator('#fish-dialog')).not_to_be_visible()
    def test_closing_pending_photo_replacement_cancels_it(self):
        # Delay real image decoding to exercise a user closing the editor mid-load.
        self.page.add_init_script("""const desc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
          Object.defineProperty(HTMLImageElement.prototype,'src',{...desc,set(value){
            if(value.startsWith('blob:'))setTimeout(()=>{this.addEventListener('load',()=>window.photoDecoded=true,{once:true});desc.set.call(this,value)},1500);
            else desc.set.call(this,value);
          }});""")
        self.open(); self.page.locator('.resident').first.click()
        with self.page.expect_file_chooser() as chooser:
            self.page.locator('#replace-photo').click()
        chooser.value.set_files(str(next(Path('.').glob('*.jpeg'))))
        self.page.locator('#close-dialog').click()
        self.page.wait_for_function('window.photoDecoded===true')
        self.page.wait_for_timeout(250)  # Let downstream data-URL decoding finish too.
        expect(self.page.locator('#fish-dialog')).not_to_be_visible()
        expect(self.page.locator('.resident')).to_have_count(3)
        self.assertEqual(self.errors,[])
    def test_webgl_failure(self):
        self.page.add_init_script("const original=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args)}")
        self.page.goto('http://127.0.0.1:4173')
        expect(self.page.locator('#scene-error')).to_be_visible(timeout=15000)
        expect(self.page.locator('#scene-error')).to_contain_text('WebGL')

if __name__=='__main__': unittest.main()
