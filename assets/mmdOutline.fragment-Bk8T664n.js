import{y as r}from"./index-cSFNPLLi.js";const e="mmdOutlinePixelShader",n=`
uniform color: vec4f;
#ifdef ALPHATEST
varying vUV: vec2;var diffuseSamplerSampler: sampler;var diffuseSampler: texture_2d<f32>;
#endif
#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
#ifdef ALPHATEST
if (textureSample(diffuseSampler,diffuseSamplerSampler,fragmentInputs.vUV).a<0.4) {discard;}
#endif
#include<logDepthFragment>
fragmentOutputs.color=uniforms.color;
#define CUSTOM_FRAGMENT_MAIN_END
}
`;r.ShadersStoreWGSL[e]=n;const t={name:e,shader:n};export{t as mmdOutlinePixelShader};
