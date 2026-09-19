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
        expect(self.page.locator('.resident')).to_have_count(9)
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
    def test_portrait_material_follows_body_surface(self):
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
    def test_photo_is_on_the_head_not_the_back_or_flanks(self):
        self.open()
        samples=self.page.evaluate("""async()=>{
          const THREE=await import('three'); const {Aquarium}=await import('./js/aquarium.js');
          const factory=Object.create(Aquarium.prototype), canvas=document.createElement('canvas');
          canvas.width=canvas.height=32;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,32,32);
          const fish=factory.createFish('#000000',canvas);
          const scene=new THREE.Scene();scene.add(fish,new THREE.AmbientLight('#ffffff',3));
          const camera=new THREE.PerspectiveCamera(35,1,.1,20),renderer=new THREE.WebGLRenderer();
          renderer.setSize(64,64);const target=new THREE.WebGLRenderTarget(64,64);renderer.setRenderTarget(target);
          const result=[];for(const point of [[5,0,0],[-5,0,0],[0,0,5],[0,0,-5]]){
            camera.position.set(...point);camera.lookAt(0,0,0);renderer.render(scene,camera);
            const pixel=new Uint8Array(4);renderer.readRenderTargetPixels(target,32,32,1,1,pixel);result.push(pixel[0]);
          }
          factory.disposeObject(fish);target.dispose();renderer.dispose();return result;
        }""")
        self.assertGreater(samples[0],150,samples)
        self.assertTrue(all(value<30 for value in samples[1:]),samples)
    def test_play_gestures_and_view_mode(self):
        self.open()
        expect(self.page.locator('#play-mode')).to_have_attribute('aria-pressed','true')
        canvas=self.page.locator('#aquarium canvas');box=canvas.bounding_box()
        x,y=box['x']+box['width']*.5,box['y']+box['height']*.45
        self.page.mouse.click(x,y)
        expect(self.page.locator('#toast')).to_contain_text('톡')
        self.page.mouse.move(x+40,y+10)
        expect(self.page.locator('#play-status')).to_contain_text('친구들이 손끝을 따라와요')
        self.page.mouse.down();self.page.wait_for_timeout(550)
        expect(self.page.locator('#play-status')).to_contain_text('기포를 만드는 중')
        self.page.mouse.up()
        expect(self.page.locator('#play-status')).not_to_contain_text('기포를 만드는 중')
        self.page.locator('#view-mode').click()
        expect(self.page.locator('#view-mode')).to_have_attribute('aria-pressed','true')
        expect(self.page.locator('#play-status')).to_contain_text('둘러보기')
        self.page.mouse.click(x,y);expect(self.page.locator('#play-status')).to_contain_text('둘러보기')
        self.page.locator('#feed').click();expect(self.page.locator('#toast')).to_contain_text('먹이')
    def test_play_steering_and_effect_cleanup(self):
        self.open()
        result=self.page.evaluate("""async()=>{
          const THREE=await import('three'); const {Aquarium}=await import('./js/aquarium.js');
          const {TankPlay}=await import('./js/tank-play.js');const {DEFAULT_FISH,portraitCanvas}=await import('./js/portraits.js');
          const host=document.createElement('div');host.style.cssText='width:600px;height:400px';document.body.append(host);
          const tank=new Aquarium(host,{reducedMotion:true});tank.renderer.setAnimationLoop(null);
          tank.setFish([DEFAULT_FISH[0]],[await portraitCanvas(DEFAULT_FISH[0])]);tank.play=new TankPlay(tank);
          const fish=tank.fish[0];fish.phase=0;fish.mesh.position.set(-4,0,0);fish.velocity.set(0,0,0);
          const goal=new THREE.Vector3(3,0,3);const before=fish.mesh.position.distanceTo(goal);
          tank.play.followAt(goal);for(let i=0;i<90;i++)tank.update(1/60);
          const followed=fish.mesh.position.distanceTo(goal)<before-1;
          tank.play.clear();fish.mesh.position.set(0,0,0);fish.velocity.set(0,0,0);
          const tap=new THREE.Vector3(1,0,0);tank.play.tapAt(tap);
          for(let i=0;i<30;i++)tank.update(1/60);
          const fled=fish.mesh.position.distanceTo(tap)>1.2;
          for(let i=0;i<80;i++)tank.update(1/60);
          const curious=tank.play.getIntent(fish)?.scared!==true;
          tank.feed();const feedingWins=tank.play.getIntent(fish)===null;
          tank.play.emitBubbles(goal,200);const limited=tank.play.particles.length===96;
          for(let i=0;i<10;i++)tank.play.tapAt(tap);const rippleLimited=tank.play.ripples.length===6;
          for(let i=0;i<480;i++)tank.update(1/60);
          const cleaned=tank.play.particles.length===0&&tank.play.ripples.length===0;
          tank.play.dispose();tank.observer.disconnect();tank.controls.dispose();tank.renderer.dispose();host.remove();
          return {followed,fled,curious,feedingWins,limited,rippleLimited,cleaned};
        }""")
        self.assertTrue(all(result.values()),result)
    def test_touch_pinch_and_cancel_do_not_leave_bubbles_running(self):
        self.page.set_viewport_size({'width':390,'height':844});self.open()
        session=self.context.new_cdp_session(self.page)
        box=self.page.locator('#aquarium canvas').bounding_box()
        x,y=box['x']+box['width']*.4,box['y']+box['height']*.45
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
        self.page.wait_for_timeout(550)
        expect(self.page.locator('#play-status')).to_contain_text('기포를 만드는 중')
        session.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
        expect(self.page.locator('#play-status')).not_to_contain_text('기포를 만드는 중')
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':2},{'x':x+65,'y':y,'id':3}]})
        session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-10,'y':y,'id':2},{'x':x+85,'y':y,'id':3}]})
        self.page.wait_for_timeout(550)
        expect(self.page.locator('#play-status')).not_to_contain_text('기포를 만드는 중')
        session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':4}]})
        session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+30,'y':y,'id':4}]})
        expect(self.page.locator('#play-status')).to_contain_text('친구들이 손끝을 따라와요')
        session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        expect(self.page.locator('#play-status')).not_to_contain_text('친구들이 손끝을 따라와요')
    def test_lost_pointer_capture_allows_next_gesture(self):
        self.open()
        result=self.page.evaluate("""async()=>{
          const {Aquarium}=await import('./js/aquarium.js');const {TankPlay}=await import('./js/tank-play.js');
          const host=document.createElement('div');host.style.cssText='width:600px;height:400px';document.body.append(host);
          const tank=new Aquarium(host,{reducedMotion:true});tank.renderer.setAnimationLoop(null);
          tank.controls.dispose();const play=new TankPlay(tank),canvas=tank.renderer.domElement;
          const down=id=>canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:id,pointerType:'touch',button:0,clientX:100,clientY:100}));
          down(11);canvas.dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:11,pointerType:'touch'}));
          down(12);await new Promise(resolve=>setTimeout(resolve,500));
          const resumed=play.emitting===true;
          canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:12}));
          const stopped=!play.emitting&&play.pointers.size===0;
          play.dispose();tank.observer.disconnect();tank.controls.dispose();tank.renderer.dispose();host.remove();
          return {resumed,stopped};
        }""")
        self.assertTrue(all(result.values()),result)
    def test_saved_residents_are_ignored_and_cards_are_read_only(self):
        self.open()
        self.page.evaluate("""()=>localStorage.setItem('doongdoong.fish.v1',JSON.stringify([
          {id:'old',name:'이전 브라우저 물고기',src:'./KakaoTalk_Photo_2026-09-14-21-55-43.jpeg',color:'#abcdef',crop:{x:.5,y:.5,zoom:2}}
        ]))""")
        self.page.reload(); expect(self.page.locator('.resident')).to_have_count(9)
        expect(self.page.locator('.resident-name')).to_have_text(['채붕이','???','장꽉수','하붕이','페어빌레','아그다','홍햄','레전드 세일러문 하츠투하츠 쵀정우','이  강  준'])
        expect(self.page.locator('input[type=file], dialog, #add-fish, .add-card')).to_have_count(0)
        expect(self.page.locator('#residents button')).to_have_count(0)
        self.page.locator('.resident').first.click()
        expect(self.page.get_by_role('dialog')).to_have_count(0)
        self.page.locator('#feed').click(); expect(self.page.locator('#toast')).to_contain_text('먹이')
        self.page.reload(); expect(self.page.locator('.resident')).to_have_count(9)
    def test_storage_is_not_required_or_accessed(self):
        self.page.add_init_script("""window.storageCalls=[];
          for(const key of ['localStorage','sessionStorage']) Object.defineProperty(window,key,{get(){window.storageCalls.push(key);throw new Error('Storage is unavailable')}});""")
        self.open(); expect(self.page.locator('.resident')).to_have_count(9)
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
    def test_dance_toggle_pause_and_feeding(self):
        self.open()
        dance=self.page.get_by_role('button',name='춤추기',exact=True)
        expect(dance).to_be_enabled();dance.click()
        expect(self.page.locator('#dance')).to_have_attribute('aria-pressed','true')
        expect(self.page.locator('#dance-banner')).to_be_visible()
        expect(self.page.locator('#dance-status')).to_contain_text('박자')
        self.page.locator('#speed').fill('1.5')
        expect(self.page.locator('#dance-bpm')).to_have_text('180 BPM')
        self.page.locator('#pause').click()
        expect(self.page.locator('#pause')).to_have_attribute('aria-pressed','true')
        expect(self.page.locator('#dance-status')).to_contain_text('잠깐')
        self.page.locator('#pause').click()
        self.page.locator('#dance').click()
        expect(self.page.locator('#dance')).to_have_attribute('aria-pressed','false')
        expect(self.page.locator('#dance-banner')).to_be_hidden()
        self.page.locator('#dance').click();self.page.locator('#feed').click()
        expect(self.page.locator('#dance')).to_have_attribute('aria-pressed','false')
        expect(self.page.locator('#toast')).to_contain_text('먹이')
        expect(self.page.locator('#pause')).to_have_attribute('aria-pressed','false')

    def test_dance_faces_camera_keeps_the_beat_and_cleans_up(self):
        self.open()
        result=self.page.evaluate("""async()=>{
          const THREE=await import('three');const {Aquarium}=await import('./js/aquarium.js');
          const {DEFAULT_FISH,portraitCanvas}=await import('./js/portraits.js');
          const {FishDance}=await import('./js/fish-dance.js');
          const host=document.createElement('div');host.style.cssText='width:600px;height:400px';document.body.append(host);
          const tank=new Aquarium(host);tank.renderer.setAnimationLoop(null);
          tank.setFish(DEFAULT_FISH,await Promise.all(DEFAULT_FISH.map(portraitCanvas)));
          tank.dance=new FishDance(tank);const baseline=tank.scene.children.length;
          const start=tank.fish.map(f=>f.mesh.position.clone());
          const started=tank.dance.start(),exclusive=!tank.dance.start();
          let bounded=true;
          for(let i=0;i<240;i++){
            tank.update(1/60);
            bounded&&=[...tank.fish,...tank.school].every(({mesh:m},i)=>Number.isFinite(m.position.x)&&Math.abs(m.position.x)<=9.5&&m.position.y>=-3&&m.position.y<=3.7&&Math.abs(m.position.z)<=(i<tank.fish.length?3.7:4.2));
          }
          const moved=tank.fish.every((f,i)=>f.mesh.position.distanceTo(start[i])>.2);
          const facing=()=>[...tank.fish,...tank.school].every(({mesh:m})=>new THREE.Vector3(1,0,0).applyQuaternion(m.quaternion).dot(tank.camera.position.clone().sub(m.position).normalize())>.995);
          const front=facing();tank.camera.position.set(8,4,25);tank.camera.lookAt(0,0,0);
          tank.update(1/60);const followsCamera=facing();
          const spots=[];tank.dance.group.traverse(o=>{if(o.isSpotLight)spots.push(o)});
          const lighting=()=>spots.map(o=>[o.intensity,o.color.getHex(),...o.target.position.toArray()]);
          const lightBefore=JSON.stringify(lighting());
          const overhead=spots.length>1&&spots.every(o=>o.position.y>4&&o.intensity>0);
          const before=tank.fish.map(f=>f.mesh.position.y);
          for(let i=0;i<10;i++)tank.update(1/60);
          const steps=tank.fish.map((f,i)=>f.mesh.position.y-before[i]);
          const inSync=Math.abs(steps[0])>.03&&Math.max(...steps)-Math.min(...steps)<.015;
          const visibleLights=overhead&&JSON.stringify(lighting())!==lightBefore;
          const lightsBeforePause=JSON.stringify(lighting());
          const positions=tank.fish.map(f=>f.mesh.position.clone());
          tank.paused=true;tank.frame(1000);tank.frame(1030);
          const paused=tank.fish.every((f,i)=>f.mesh.position.distanceTo(positions[i])<1e-8)&&JSON.stringify(lighting())===lightsBeforePause;
          tank.setNight(true);tank.dance.stop();
          const restored=!tank.dance.active&&tank.scene.children.length===baseline&&Math.abs(tank.ambient.intensity-.85)<1e-8;
          let repeatable=true;
          for(let i=0;i<3;i++){tank.dance.start();tank.update(.1);tank.dance.stop();repeatable&&=tank.scene.children.length===baseline;}
          tank.paused=false;const after=tank.fish.map(f=>f.mesh.position.clone());
          for(let i=0;i<120;i++)tank.update(1/60);
          const swimming=tank.fish.every((f,i)=>f.mesh.position.distanceTo(after[i])>.1&&Math.abs(f.mesh.rotation.x)<1e-8);
          tank.dance.dispose();tank.observer.disconnect();tank.controls.dispose();tank.renderer.dispose();host.remove();
          return {started,exclusive,bounded,moved,front,followsCamera,inSync,visibleLights,paused,restored,repeatable,swimming};
        }""")
        self.assertTrue(all(result.values()),result)

    def test_mobile_reduced_motion_dance_can_be_started_and_stopped(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.emulate_media(reduced_motion='reduce');self.open()
        expect(self.page.locator('#pause')).to_have_attribute('aria-pressed','true')
        self.page.locator('#dance').click()
        expect(self.page.locator('#pause')).to_have_attribute('aria-pressed','false')
        expect(self.page.locator('#dance')).to_have_attribute('aria-pressed','true')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))
        self.page.locator('#dance').focus();self.page.keyboard.press('Enter')
        expect(self.page.locator('#dance')).to_have_attribute('aria-pressed','false')

    def test_webgl_failure(self):
        self.page.add_init_script("const original=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args)}")
        self.page.goto(os.environ.get('AQUARIUM_URL','http://127.0.0.1:4173'))
        expect(self.page.locator('#scene-error')).to_be_visible(timeout=15000)
        expect(self.page.locator('#scene-error')).to_contain_text('WebGL')

if __name__=='__main__': unittest.main()
