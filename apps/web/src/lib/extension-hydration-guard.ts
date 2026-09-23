/**
 * Browser extensions (Bitdefender, Grammarly, ColorZilla, …) inject attributes
 * into the DOM before React hydrates, which triggers Next.js hydration overlays
 * in development. Strip known attrs before and during early hydration.
 */
export const EXTENSION_HYDRATION_GUARD = `(function(){
  var ATTRS=['bis_skin_checked','bis_register','cz-shortcut-listen','data-new-gr-c-s-check-loaded','data-gr-ext-installed','data-gr-ext-disabled'];
  var PREFIXES=['__processed_'];
  function clean(el){
    if(!el||el.nodeType!==1||!el.removeAttribute)return;
    for(var i=0;i<ATTRS.length;i++){
      if(el.hasAttribute&&el.hasAttribute(ATTRS[i]))el.removeAttribute(ATTRS[i]);
    }
    if(el.getAttributeNames){
      var names=el.getAttributeNames();
      for(var j=0;j<names.length;j++){
        for(var k=0;k<PREFIXES.length;k++){
          if(names[j].indexOf(PREFIXES[k])===0)el.removeAttribute(names[j]);
        }
      }
    }
  }
  function walk(node){
    if(!node)return;
    clean(node);
    if(!node.querySelectorAll)return;
    var all=node.querySelectorAll('*');
    for(var i=0;i<all.length;i++)clean(all[i]);
  }
  try{
    walk(document.documentElement);
    var obs=new MutationObserver(function(mutations){
      for(var i=0;i<mutations.length;i++){
        var m=mutations[i];
        if(m.type==='attributes')clean(m.target);
        var added=m.addedNodes;
        for(var j=0;j<added.length;j++)walk(added[j]);
      }
    });
    obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:ATTRS});
    window.addEventListener('load',function(){
      setTimeout(function(){try{obs.disconnect();}catch(e){}},4000);
    });
  }catch(e){}
})();`;
