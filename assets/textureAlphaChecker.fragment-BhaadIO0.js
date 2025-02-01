import{y as t}from"./index-cSFNPLLi.js";const e="textureAlphaCheckerPixelShader",r=`
precision highp float;uniform sampler2D textureSampler;varying vec2 vUv;void main() {gl_FragColor=vec4(vec3(1.0)-vec3(texture2D(textureSampler,vUv).a),1.0);}
`;t.ShadersStore[e]=r;const o={name:e,shader:r};export{o as textureAlphaCheckerPixelShader};
