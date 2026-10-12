/* Real 3D gold coin: beveled solid mesh, raised numerals, separate outward-facing sides. */
(()=>{
 let instance=null;
 window.ChatBattleCoin={play(side,reduced){instance??=initialize();return instance.play(side,reduced);},cancel(){instance?.cancel();}};
 function initialize(){
 const canvas=document.getElementById('coinCanvas'),gl=canvas.getContext('webgl',{alpha:true,antialias:true});
 if(!gl)return {play:()=>Promise.reject(new Error('WebGL unavailable')),cancel(){}};
 const vertex=`attribute vec3 p,n;attribute float tone;varying float T;uniform vec3 rotation;uniform float lift;varying vec3 N,P;void main(){vec3 c=cos(rotation),s=sin(rotation);mat3 rx=mat3(1.,0.,0.,0.,c.x,s.x,0.,-s.x,c.x),ry=mat3(c.y,0.,-s.y,0.,1.,0.,s.y,0.,c.y),rz=mat3(c.z,s.z,0.,-s.z,c.z,0.,0.,0.,1.);mat3 r=rz*rx*ry;P=r*p;N=r*n;T=tone;float depth=5.-P.z;gl_Position=vec4(P.x*3.4,P.y*3.4+lift,depth*1.02-.202,depth);}`;
 const fragment=`precision highp float;varying vec3 N,P;varying float T;void main(){vec3 n=normalize(N),v=normalize(vec3(0.,0.,5.)-P);vec3 l=normalize(vec3(-3.,4.,5.)),l2=normalize(vec3(4.,1.,2.));float d=max(dot(n,l),0.),d2=max(dot(n,l2),0.);float spec=pow(max(dot(n,normalize(l+v)),0.),70.);float spec2=pow(max(dot(n,normalize(l2+v)),0.),100.);float band=pow(max(0.,1.-abs(dot(reflect(-v,n),normalize(vec3(-.7,.9,.4))))),18.);vec3 gold=vec3(1.,.68,.14);vec3 color=gold*(.28+.55*d+.22*d2)+vec3(1.,.91,.62)*(spec*.95+spec2*.65+band*.13);gl_FragColor=vec4(color*T,1.);}`;
 function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);gl.useProgram(program);
 const positions=[],normals=[],tones=[];let materialTone=1;
 function tri(a,b,c){const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);for(const pt of [a,b,c]){positions.push(...pt);tones.push(materialTone);normals.push(...n.map(x=>x/len));}}
 function lathe(profile){for(let i=0;i<160;i++){const a=i*Math.PI/80,b=(i+1)*Math.PI/80;for(let j=0;j<profile.length-1;j++){const [r,z]=profile[j],[r2,z2]=profile[j+1],p=[r*Math.cos(a),r*Math.sin(a),z],q=[r*Math.cos(b),r*Math.sin(b),z],t=[r2*Math.cos(b),r2*Math.sin(b),z2],u=[r2*Math.cos(a),r2*Math.sin(a),z2];tri(p,q,t);tri(p,t,u);}}}
 lathe([[0,-.145],[.93,-.145],[.985,-.125],[1,-.095],[1,.095],[.985,.125],[.93,.145],[0,.145]]);
 for(const sign of [-1,1]){
  lathe([[.82,sign*.145],[.83,sign*.161],[.85,sign*.168],[.87,sign*.161],[.88,sign*.145]]);
 }
 // Ear clipping preserves the concave outline of 2, instead of mirroring a flat image.
 function extrude(poly,back){const points=poly.map(([x,y])=>[x*.9,y*.9]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1]},0)<0)points.reverse();
 const xyz=(p,z)=>{const k=z>.18?.94:1;return back?[-p[0]*k,p[1]*k,-z]:[p[0]*k,p[1]*k,z];};let ids=points.map((_,i)=>i),guard=0;
 while(ids.length>2&&guard++<200){let found=false;for(let i=0;i<ids.length;i++){const a=points[ids[(i+ids.length-1)%ids.length]],b=points[ids[i]],c=points[ids[(i+1)%ids.length]];if(cross(a,b,c)<=0)continue;if(ids.some(id=>{const p=points[id];return p!==a&&p!==b&&p!==c&&cross(a,b,p)>=0&&cross(b,c,p)>=0&&cross(c,a,p)>=0}))continue;tri(xyz(a,.195),xyz(b,.195),xyz(c,.195));ids.splice(i,1);found=true;break;}if(!found)break;}
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];tri(xyz(a,.145),xyz(b,.145),xyz(b,.195));tri(xyz(a,.145),xyz(b,.195),xyz(a,.195));}}
 materialTone=1.1;
 extrude([[-.23,.31],[-.03,.5],[.13,.5],[.13,-.34],[.3,-.34],[.3,-.49],[-.29,-.49],[-.29,-.34],[-.08,-.34],[-.08,.27],[-.23,.17]],false);
 extrude([[-.34,.27],[-.28,.43],[-.12,.52],[.13,.52],[.3,.4],[.35,.23],[.29,.06],[-.13,-.31],[.35,-.31],[.35,-.49],[-.35,-.49],[-.35,-.29],[.13,.15],[.16,.26],[.1,.34],[-.08,.34],[-.16,.27],[-.17,.17],[-.34,.17]],true);
 for(const [name,data] of [['p',positions],['n',normals],['tone',tones]]){const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,name==='tone'?1:3,gl.FLOAT,false,0,0);}
 gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);const rot=gl.getUniformLocation(program,'rotation'),lift=gl.getUniformLocation(program,'lift');let raf=0,resolvePending;
 function draw(x,y,z,h){if(document.hidden)return;gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform3f(rot,x,y,z);gl.uniform1f(lift,h);gl.drawArrays(gl.TRIANGLES,0,positions.length/3);}
 const renderer={cancel(){cancelAnimationFrame(raf);canvas.style.transform='';resolvePending?.();resolvePending=null;},play(side,reduced){this.cancel();return new Promise(resolve=>{resolvePending=resolve;canvas.style.transform='';const startY=window.innerHeight-canvas.getBoundingClientRect().top+24;canvas.style.transform=reduced?'':'translateY('+startY+'px)';const start=performance.now(),end=(side===2?Math.PI:0)+Math.PI*12;
 const smootherstep=v=>{const x=Math.max(0,Math.min(1,v));return x*x*x*(x*(x*6-15)+10);};
 function frame(now){const t=Math.min(1,(now-start)/3000),e=1-Math.pow(1-t,3),settle=1-smootherstep((t-.68)/.32);const rise=Math.min(1,t/.38),u=Math.max(0,(t-.38)/.62),y=t<.38?startY*Math.pow(1-rise,3):-24*64*Math.pow(u*(1-u),3);canvas.style.transform=reduced?'':'translateY('+y+'px)';draw(reduced?-.25:-.25+Math.sin(t*Math.PI)*.8*settle,reduced?end:end*e,reduced?-.12:Math.sin(t*Math.PI*3)*.14*settle-.12,0);if(t<1)raf=requestAnimationFrame(frame);else{resolvePending=null;resolve();
 // Keep the landed face readable while it gently rocks and floats.
 if(!reduced){const landedAt=now;function hover(time){const seconds=(time-landedAt)/1000,blend=smootherstep(seconds/2.2);draw(-.25+Math.sin(seconds*.8)*.055*blend,end+Math.sin(seconds*.65)*.075*blend,-.12+Math.sin(seconds*.5)*.03*blend,0);canvas.style.transform='translateY('+(-Math.sin(seconds*.9)*5*blend)+'px)';raf=requestAnimationFrame(hover);}raf=requestAnimationFrame(hover);}
 }}
 raf=requestAnimationFrame(frame);});}};
 draw(-.25,.35,-.12,0);
 return renderer;
 }
})();
