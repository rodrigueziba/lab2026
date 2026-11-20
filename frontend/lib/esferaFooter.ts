// Z105: shaders y parámetros de la esfera del easter egg del footer (/proyectos), movidos TAL CUAL desde
// components/Footer.tsx para compartirlos con la esfera del modo de espera de /alight (components/EsperaCamara.tsx).
// El footer los importa de acá: su apariencia y comportamiento no cambian (mismos textos de shader, mismos valores).

// ── Sphere params ────────────────────────────────────────────────────────────
export const SPH_REFRACTION        = 0.71;
export const SPH_FRACTAL_SPEED     = 1.49;
export const SPH_FRACTAL_ITER      = 61;
export const SPH_FRACTAL_INTENSITY = 0.56;
export const SPH_FRACTAL_SCALE     = 1.47;

// ── GLSL vertex ─────────────────────────────────────────────────────────────
export const SPH_VERT = /* glsl */`
  varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vWorldPos;
  void main(){
    vWorldPos=(modelMatrix*vec4(position,1.0)).xyz;
    vec4 mv=modelViewMatrix*vec4(position,1.0);
    vNormal=normalize(normalMatrix*normal);
    vViewDir=normalize(-mv.xyz);
    gl_Position=projectionMatrix*mv;
  }`;

// ── GLSL fragment ────────────────────────────────────────────────────────────
export const SPH_FRAG = /* glsl */`
  uniform sampler2D uBgTex;
  uniform vec2  uRes; uniform float uTime;
  uniform vec3  uTint;
  uniform float uBeat,uRMS,uBass,uMid,uAir,uSub;
  uniform float uRefraction,uFractalSpeed,uFractalIter,uFractalIntensity,uFractalScale,uPalette;
  varying vec3 vNormal,vViewDir,vWorldPos;

  vec2 rot2(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
  vec3 pal(float t,vec3 a,vec3 b,vec3 c,vec3 d){return a+b*cos(6.28318*(c*t+d));}
  vec3 applyPal(float t,float p){
    if(p<0.5)return pal(t,vec3(.5,.5,.5),vec3(.5,.5,.5),vec3(1.,1.,1.),vec3(0.,.33,.67));
    if(p<1.5)return pal(t,vec3(0.,.5,0.),vec3(.2,.5,.1),vec3(1.,1.,1.),vec3(0.,.15,.3));
    if(p<2.5)return pal(t,vec3(.5,0.,.5),vec3(.5,.3,.5),vec3(1.,.7,1.),vec3(.8,0.,.5));
    if(p<3.5)return pal(t,vec3(.5,.2,0.),vec3(.5,.3,0.),vec3(1.,.8,.6),vec3(0.,.1,.2));
    return     pal(t,vec3(0.,.4,.5),vec3(.2,.4,.3),vec3(1.,1.,.8),vec3(.5,.6,.7));
  }
  void main(){
    vec3 N=normalize(vNormal),V=normalize(vViewDir);
    float ndv=max(0.,dot(N,V));
    vec2 uv=gl_FragCoord.xy/uRes;
    float IOR=1.3+uBass*0.4;
    vec3 refr=refract(-V,N,1./IOR);
    float rs=uRefraction*(0.28+uBeat*0.14+uRMS*0.08);
    vec2 ro=refr.xy*rs;
    float ca=uRefraction*(0.032+uBeat*.02+uBass*.012);
    vec2 cv=vec2(ca,ca*.5);
    vec3 bg=vec3(texture2D(uBgTex,uv+ro+cv).r,texture2D(uBgTex,uv+ro).g,texture2D(uBgTex,uv+ro-cv).b);
    float spd=uFractalSpeed*(1.+uBeat*.6+uRMS*.25);
    vec2 du=rot2(vNormal.xy,uTime*spd*0.05);
    float per=7.,zA_t=mod(uTime*spd*.22,per),zB_t=mod(uTime*spd*.22+per*.5,per);
    float zA=exp(zA_t*.9),zB=exp(zB_t*.9);
    float wA=smoothstep(0.,.12,zA_t/per)*smoothstep(1.,.88,zA_t/per);
    float wB=smoothstep(0.,.12,zB_t/per)*smoothstep(1.,.88,zB_t/per);
    float ws=wA+wB+.001; wA/=ws; wB/=ws;
    float pA=uTime*spd*.06,pB=uTime*spd*.04+1.57;
    vec2 panA=vec2(cos(pA)*.32,sin(pA*.77)*.24),panB=vec2(cos(pB)*.28,sin(pB*.61)*.20);
    vec2 jc=vec2(-0.7269+sin(uTime*spd*.09)*.22+uBass*.15,0.1889+cos(uTime*spd*.07)*.16+uMid*.10);
    vec2 fcA=du*uFractalScale/zA+panA,fcB=du*uFractalScale/zB+panB;
    int mi=int(uFractalIter);
    vec2 z1=fcA; float tRA=1e5,tLA=1e5,tCA=1e5;
    for(int i=0;i<64;i++){if(i>=mi)break;z1=vec2(z1.x*z1.x-z1.y*z1.y,2.*z1.x*z1.y)+jc;float r=length(z1);tRA=min(tRA,r);tLA=min(tLA,abs(z1.x*z1.y));tCA=min(tCA,abs(r-.5));if(r>4.)break;}
    float pA2=fract(mix(1.-exp(-tRA*3.),1.-exp(-tLA*7.),.5)+uTime*spd*.035+uBeat*.12);
    vec3 fA=applyPal(pA2,uPalette)*((0.5+(1.-exp(-tRA*2.5))*.5+(1.-exp(-tCA*5.))*.4)*(1.+uBeat*.7+uRMS*.5));
    vec2 z2=fcB; float tRB=1e5,tLB=1e5,tCB=1e5;
    for(int i=0;i<64;i++){if(i>=mi)break;z2=vec2(z2.x*z2.x-z2.y*z2.y,2.*z2.x*z2.y)+jc;float r=length(z2);tRB=min(tRB,r);tLB=min(tLB,abs(z2.x*z2.y));tCB=min(tCB,abs(r-.5));if(r>4.)break;}
    float pB2=fract(mix(1.-exp(-tRB*3.),1.-exp(-tLB*7.),.5)+uTime*spd*.035+uBeat*.12+.5);
    vec3 fB=applyPal(pB2,uPalette)*((0.5+(1.-exp(-tRB*2.5))*.5+(1.-exp(-tCB*5.))*.4)*(1.+uBeat*.7+uRMS*.5));
    vec3 fc=fA*wA+fB*wB;
    float fm=smoothstep(0.,.45,ndv)*uFractalIntensity*(0.9+uRMS*.5+uBeat*.4);
    float lf=smoothstep(.25,.85,ndv)*(.35+uRMS*.55);
    bg=mix(bg,bg*(1.+lf*1.3),.65)*(1.-smoothstep(.85,.5,ndv)*.22);
    float fr=pow(1.-ndv,3.),se=pow(1.-ndv,10.);
    vec3 rim=mix(vec3(.6,.9,1.),uTint+.2,sin(vWorldPos.x*9.+uTime*2.)*sin(vWorldPos.y*7.-uTime*1.6)*.5+.5)*(1.+uBeat*1.8+uRMS*.7);
    vec3 L1=normalize(vec3(-.5,.75,.4)),L2=normalize(vec3(.55,-.3,.3));
    float s1=pow(max(0.,dot(reflect(-V,N),L1)),40.)*1.1,s2=pow(max(0.,dot(reflect(-V,N),L2)),90.)*.6;
    vec3 col=mix(bg,fc,fm)+rim*fr*.6+vec3(1.)*se*.95+vec3(1.)*(s1+s2)*(.9+uBeat*.5);
    float al=fm*.85+fr*.65+se*.95+s1*.75+s2*.45;
    gl_FragColor=vec4(col,clamp(al,0.,1.));
  }`;
