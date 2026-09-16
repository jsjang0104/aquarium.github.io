"""Start an HTTP server on :4173, then run unittest discovery in this directory."""
import unittest
import os
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
        self.console_errors=[]
        self.page.on('console',lambda message:self.console_errors.append(message.text) if message.type=='error' else None)
    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors,[])
        if self._testMethodName != 'test_webgl_failure': self.assertEqual(self.console_errors,[])
    def open(self):
        self.page.goto(os.environ.get('AQUARIUM_URL','http://127.0.0.1:4173'))
        expect(self.page.locator('body')).to_have_attribute('data-ready','true',timeout=10000)
    def test_scene_and_controls(self):
        self.open()
        expect(self.page.locator('.resident')).to_have_count(4)
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
    def test_initial_scene_and_swimming_bounds(self):
        self.open()
        result=self.page.evaluate("""async()=>{
          const {Aquarium}=await import('./js/aquarium.js');
          const {DEFAULT_FISH,portraitCanvas}=await import('./js/portraits.js');
          const host=document.createElement('div');host.style.cssText='width:600px;height:400px';document.body.append(host);
          const scene=new Aquarium(host,{reducedMotion:true});scene.renderer.setAnimationLoop(null);
          const records=DEFAULT_FISH;
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
    def test_portraits_follow_the_body_surface_on_both_sides(self):
        self.open()
        result=self.page.evaluate("""async()=>{
          const THREE=await import('three');
          const {Aquarium}=await import('./js/aquarium.js');
          const factory=Object.create(Aquarium.prototype);
          const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
          const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,32,32);
          const fish=factory.createFish('#f7b56b',canvas);fish.updateMatrixWorld(true);
          const portraits=[];fish.traverse(mesh=>{if(mesh.material?.map)portraits.push(mesh)});
          let surface=true,lit=true;const normals=[];
          for(const side of [-1,1])for(const x of [-.15,.28,.6]){
            const ray=new THREE.Raycaster(new THREE.Vector3(x,0,side*2),new THREE.Vector3(0,0,-side));
            const hit=ray.intersectObjects(portraits,false)[0];
            if(!hit){surface=false;continue;}
            const p=hit.point;
            const ellipse=(p.x/1.05)**2+(p.y/.65)**2+(p.z/.43)**2;
            surface&&=Math.abs(ellipse-1)<.015;
            lit&&=hit.object.material.isMeshStandardMaterial===true;
            normals.push(hit.face.normal.x);
          }
          const curvedNormals=Math.max(...normals)-Math.min(...normals)>.3;
          factory.disposeObject(fish);
          return {surface,lit,curvedNormals};
        }""")
        self.assertTrue(all(result.values()),result)
    def test_saved_residents_are_ignored_and_cards_are_read_only(self):
        self.open()
        self.page.evaluate("""()=>localStorage.setItem('doongdoong.fish.v1',JSON.stringify([
          {id:'old',name:'이전 브라우저 물고기',src:'./KakaoTalk_Photo_2026-09-14-21-55-43.jpeg',color:'#abcdef',crop:{x:.5,y:.5,zoom:2}}
        ]))""")
        self.page.reload(); expect(self.page.locator('.resident')).to_have_count(4)
        expect(self.page.locator('.resident-name')).to_have_text(['채붕이','???','꽉수','하붕이'])
        expect(self.page.locator('input[type=file], dialog, #add-fish, .add-card')).to_have_count(0)
        expect(self.page.locator('#residents button')).to_have_count(0)
        self.page.locator('.resident').first.click()
        expect(self.page.get_by_role('dialog')).to_have_count(0)
        self.page.locator('#feed').click(); expect(self.page.locator('#toast')).to_contain_text('먹이')
        self.page.reload(); expect(self.page.locator('.resident')).to_have_count(4)
    def test_storage_is_not_required_or_accessed(self):
        self.page.add_init_script("""window.storageCalls=[];
          for(const key of ['localStorage','sessionStorage']) Object.defineProperty(window,key,{get(){window.storageCalls.push(key);throw new Error('Storage is unavailable')}});""")
        self.open(); expect(self.page.locator('.resident')).to_have_count(4)
        self.page.locator('#feed').click(); expect(self.page.locator('#toast')).to_contain_text('먹이')
        self.assertEqual(self.page.evaluate('window.storageCalls'),[])
    def test_mobile_reduced_motion_and_keyboard_feeding(self):
        self.page.set_viewport_size({'width':390,'height':844}); self.page.emulate_media(reduced_motion='reduce')
        self.open(); expect(self.page.locator('#pause')).to_have_attribute('aria-pressed','true')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))
        self.page.keyboard.press('f')
        expect(self.page.locator('#toast')).to_contain_text('먹이')
        expect(self.page.locator('#pause')).to_have_attribute('aria-pressed','false')
        self.page.screenshot(path='/tmp/aquarium-fixed-mobile.png',full_page=True)
    def test_webgl_failure(self):
        self.page.add_init_script("const original=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args)}")
        self.page.goto(os.environ.get('AQUARIUM_URL','http://127.0.0.1:4173'))
        expect(self.page.locator('#scene-error')).to_be_visible(timeout=15000)
        expect(self.page.locator('#scene-error')).to_contain_text('WebGL')

if __name__=='__main__': unittest.main()
