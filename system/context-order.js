// Состояние сохраняется отдельно для каждого профиля; старые профили llama.cpp распознаются по имени.
function enabled(profile){if(typeof profile?.cacheFriendlyContext==='boolean')return profile.cacheFriendlyContext;if(profile?.kind==='cloud'||profile?.protocol==='opencode')return false;return profile?.presetId==='llama'||/llama\s*\.?\s*cpp/i.test(profile?.name||'')}
function systemOrder(profile,base,notes,tail){return enabled(profile)?base+notes+tail:base+tail+notes}
module.exports={enabled,systemOrder};
