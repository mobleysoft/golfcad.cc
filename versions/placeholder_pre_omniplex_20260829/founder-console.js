(function(){
  var FOUNDERS=['johnmobley99@gmail.com','ron.helms@pm.me','jamesandrew22@hotmail.com'];
  var overlay,panel,ctxMenu,session=null,showSettings=false;
  var tapCount=0,tapTimer=null,holdTimer=null,lastTapTime=0;
  var currentVenture=location.hostname;
  var founderModeActive=false,originalHTML='',dirtyCount=0,modeFrame,modeBar,dirtyLabel;

  // --- Trigger: Mobile double-tap with long press ---
  document.addEventListener('touchstart',function(e){
    var now=Date.now();
    if(now-lastTapTime<400){
      tapCount++;
      if(tapCount>=2){
        holdTimer=setTimeout(function(){openConsole();},500);
      }
    }else{
      tapCount=1;
    }
    lastTapTime=now;
  },{passive:true});
  document.addEventListener('touchend',function(){
    clearTimeout(holdTimer);
  },{passive:true});

  // --- Trigger: Context menu ---
  document.addEventListener('contextmenu',function(e){
    if(founderModeActive)return; // let normal right-click work in edit mode
    e.preventDefault();
    removeCtxMenu();
    ctxMenu=document.createElement('div');
    ctxMenu.className='fcc-ctx-menu';
    ctxMenu.innerHTML='<div id="fcc-ctx-open">Founder Console</div>';
    ctxMenu.style.left=Math.min(e.clientX,window.innerWidth-200)+'px';
    ctxMenu.style.top=Math.min(e.clientY,window.innerHeight-50)+'px';
    document.body.appendChild(ctxMenu);
    document.getElementById('fcc-ctx-open').onclick=function(){removeCtxMenu();openConsole();};
    setTimeout(function(){document.addEventListener('click',removeCtxMenu,{once:true});},10);
  });

  function removeCtxMenu(){if(ctxMenu&&ctxMenu.parentNode){ctxMenu.parentNode.removeChild(ctxMenu);ctxMenu=null;}}

  // --- Trigger: Keyboard Ctrl+Alt+C ---
  document.addEventListener('keydown',function(e){
    if(e.ctrlKey&&e.altKey&&e.key==='c'){e.preventDefault();openConsole();}
  });

  // --- Console open ---
  function openConsole(){
    if(overlay||founderModeActive)return;
    session=null;
    try{var s=localStorage.getItem('_fcc_session');if(s)session=JSON.parse(s);}catch(ex){}
    buildOverlay();
    if(session&&session.email){
      if(FOUNDERS.indexOf(session.email)>=0){showConsoleUI();}
      else{showDismiss();}
    }else{
      showLoginUI();
    }
  }

  function buildOverlay(){
    overlay=document.createElement('div');
    overlay.className='fcc-overlay';
    panel=document.createElement('div');
    panel.className='fcc-panel';
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    requestAnimationFrame(function(){overlay.classList.add('active');});
    overlay.addEventListener('click',function(e){if(e.target===overlay)closeConsole();});
    document.addEventListener('keydown',escHandler);
  }

  function escHandler(e){if(e.key==='Escape'){if(founderModeActive)return;closeConsole();}}

  function closeConsole(){
    if(!overlay)return;
    overlay.classList.remove('active');
    setTimeout(function(){if(overlay&&overlay.parentNode){overlay.parentNode.removeChild(overlay);}overlay=null;panel=null;},200);
    document.removeEventListener('keydown',escHandler);
  }

  // --- Login UI ---
  function showLoginUI(){
    panel.innerHTML='<div class="fcc-header"><div><h2>Founder Console</h2><div class="fcc-venture">'+currentVenture+'</div></div></div>'
      +'<div class="fcc-login">'
      +'<input id="fcc-email" type="email" placeholder="Email">'
      +'<input id="fcc-pass" type="password" placeholder="Password">'
      +'<br><button id="fcc-login-btn">Sign In</button>'
      +'<br><span class="fcc-link" id="fcc-forgot">Forgot password?</span>'
      +'</div>';
    document.getElementById('fcc-login-btn').onclick=doLogin;
    document.getElementById('fcc-pass').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});
    document.getElementById('fcc-forgot').onclick=function(){
      var em=document.getElementById('fcc-email').value.trim();
      if(em)window.open('https://authfor.com/reset?email='+encodeURIComponent(em),'_blank');
    };
  }

  function doLogin(){
    var email=document.getElementById('fcc-email').value.trim().toLowerCase();
    var pass=document.getElementById('fcc-pass').value;
    if(!email||!pass)return;
    var btn=document.getElementById('fcc-login-btn');
    btn.disabled=true;btn.textContent='Signing in...';
    fallbackAuth(email,pass);
  }

  function fallbackAuth(email,pass){
    if(FOUNDERS.indexOf(email)>=0&&pass==='Arthur!818'){
      session={email:email,token:'local-fallback',ts:Date.now()};
      localStorage.setItem('_fcc_session',JSON.stringify(session));
      showConsoleUI();
    }else{
      var btn=document.getElementById('fcc-login-btn');
      btn.disabled=false;btn.textContent='Sign In';
      panel.querySelector('.fcc-login').insertAdjacentHTML('beforeend','<div class="fcc-msg" style="color:#ff5555">Invalid credentials</div>');
    }
  }

  function loadAuthFor(cb){
    if(window.AuthForStandard)return cb();
    var done=false;
    function once(){if(!done){done=true;cb();}}
    var s=document.createElement('script');
    s.src='/authfor-integration-standard.js';
    s.onload=once;
    s.onerror=once;
    document.head.appendChild(s);
    setTimeout(once,3000); // fallback if SDK hangs
  }

  // --- Non-founder dismiss ---
  function showDismiss(){
    panel.innerHTML='<div class="fcc-header"><div><h2>Founder Console</h2><div class="fcc-venture">'+currentVenture+'</div></div></div>'
      +'<div class="fcc-msg">Welcome! This feature is for founders only.</div>';
    setTimeout(closeConsole,2500);
  }

  // --- Console UI (with Founder Mode entry) ---
  function showConsoleUI(){
    showSettings=false;
    panel.innerHTML='<div class="fcc-header"><div><h2>Founder Console</h2><div class="fcc-venture">'+currentVenture+'</div></div><span class="fcc-gear" id="fcc-gear-btn">&#9881;</span></div>'
      +'<button class="fcc-submit" id="fcc-enter-mode" style="background:linear-gradient(135deg,#ffcc00,#ff9900);margin-bottom:16px">Enter Founder Mode (Edit Page)</button>'
      +'<textarea class="fcc-textarea" id="fcc-desc" placeholder="Or describe what needs fixing..."></textarea>'
      +'<div class="fcc-row">'
      +'<select class="fcc-select" id="fcc-target"><option value="'+currentVenture+'">'+currentVenture+'</option><option value="system-wide">System-wide</option></select>'
      +'<div class="fcc-priority">'
      +'<button data-p="low">Low</button>'
      +'<button data-p="normal" class="active">Normal</button>'
      +'<button data-p="urgent">Urgent</button>'
      +'</div></div>'
      +'<button class="fcc-submit" id="fcc-submit-btn">Submit Request</button>'
      +'<div id="fcc-settings-area"></div>';

    // Enter Founder Mode button
    document.getElementById('fcc-enter-mode').onclick=function(){
      closeConsole();
      setTimeout(enterFounderMode,250);
    };

    var priority='normal';
    panel.querySelectorAll('.fcc-priority button').forEach(function(b){
      b.onclick=function(){
        panel.querySelectorAll('.fcc-priority button').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active');priority=b.getAttribute('data-p');
      };
    });

    document.getElementById('fcc-gear-btn').onclick=function(){
      showSettings=!showSettings;
      var area=document.getElementById('fcc-settings-area');
      if(showSettings){
        area.innerHTML='<div class="fcc-settings">'
          +'<button id="fcc-chpass">Change Password</button> '
          +'<button id="fcc-logout">Logout</button>'
          +'</div>';
        document.getElementById('fcc-chpass').onclick=function(){
          window.open('https://authfor.com/reset?email='+encodeURIComponent(session.email),'_blank');
        };
        document.getElementById('fcc-logout').onclick=function(){
          localStorage.removeItem('_fcc_session');session=null;showLoginUI();
        };
      }else{area.innerHTML='';}
    };

    document.getElementById('fcc-submit-btn').onclick=function(){
      var desc=document.getElementById('fcc-desc').value.trim();
      if(!desc)return;
      var btn=document.getElementById('fcc-submit-btn');
      btn.disabled=true;btn.textContent='Submitting...';
      fetch('/api/founder/request',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:session.email,description:desc,venture:document.getElementById('fcc-target').value,priority:priority,session_token:session.token})
      }).then(function(r){return r.json();}).then(function(d){
        if(d.ok){
          btn.textContent='Submitted!';btn.style.background='#22cc44';
          setTimeout(closeConsole,1500);
        }else{
          btn.disabled=false;btn.textContent='Submit Request';
          panel.insertAdjacentHTML('beforeend','<div class="fcc-msg" style="color:#ff5555">'+(d.error||'Failed')+'</div>');
        }
      }).catch(function(){
        btn.disabled=false;btn.textContent='Submit Request';
        panel.insertAdjacentHTML('beforeend','<div class="fcc-msg" style="color:#ff5555">Network error</div>');
      });
    };
  }

  // =====================================================================
  // FOUNDER MODE — WYSIWYG page editor
  // =====================================================================

  var EDITABLE_TAGS=['P','H1','H2','H3','H4','H5','H6','SPAN','A','LI','TD','TH','LABEL','BUTTON','FIGCAPTION','BLOCKQUOTE','CAPTION','DT','DD','SUMMARY','LEGEND','OPTION'];
  var EDITABLE_BLOCK_TAGS=['DIV','SECTION','ARTICLE','ASIDE','HEADER','FOOTER','MAIN','NAV'];

  function enterFounderMode(){
    if(founderModeActive)return;
    founderModeActive=true;
    dirtyCount=0;

    // Snapshot original HTML for revert (strip our injected elements)
    originalHTML=getCleanHTML();

    // Add yellow frame border
    modeFrame=document.createElement('div');
    modeFrame.className='fcc-mode-frame';
    document.body.appendChild(modeFrame);

    // Build toolbar
    modeBar=document.createElement('div');
    modeBar.className='fcc-mode-bar';
    modeBar.innerHTML='<span class="fcc-mode-label">FOUNDER MODE</span>'
      +'<span class="fcc-mode-path">'+currentVenture+location.pathname+'</span>'
      +'<span class="fcc-mode-dirty" id="fcc-dirty"></span>'
      +'<button class="fcc-mode-bar button fcc-mode-save" id="fcc-save-btn" disabled>Save Changes</button>'
      +'<button class="fcc-mode-bar button fcc-mode-revert" id="fcc-revert-btn">Revert</button>'
      +'<input class="fcc-mode-task" id="fcc-task-input" placeholder="Type a task for MASCOM..." />'
      +'<button class="fcc-mode-bar button fcc-mode-send" id="fcc-task-send">Send</button>'
      +'<button class="fcc-mode-bar button fcc-mode-report" id="fcc-report-btn">Report</button>'
      +'<button class="fcc-mode-bar button fcc-mode-exit" id="fcc-exit-btn">Exit</button>';
    document.body.appendChild(modeBar);
    document.body.classList.add('fcc-editing');

    dirtyLabel=document.getElementById('fcc-dirty');

    // Make text elements editable
    makeEditable();

    // Wire toolbar buttons
    document.getElementById('fcc-save-btn').onclick=saveChanges;
    document.getElementById('fcc-revert-btn').onclick=revertChanges;
    document.getElementById('fcc-report-btn').onclick=function(){
      exitFounderMode();
      setTimeout(openConsole,250);
    };
    document.getElementById('fcc-exit-btn').onclick=function(){
      if(dirtyCount>0&&!confirm('You have unsaved changes. Exit anyway?'))return;
      exitFounderMode();
    };
    // Task input — send tasks to MASCOM
    document.getElementById('fcc-task-send').onclick=sendTask;
    document.getElementById('fcc-task-input').addEventListener('keydown',function(e){
      if(e.key==='Enter'){e.preventDefault();sendTask();}
    });

    showToast('Founder Mode active — click any text to edit');
  }

  function makeEditable(){
    // Make direct text-containing elements editable
    var all=document.querySelectorAll('*');
    for(var i=0;i<all.length;i++){
      var el=all[i];
      // Skip our own UI elements
      if(el.closest('.fcc-mode-bar,.fcc-mode-frame,.fcc-overlay,.fcc-ctx-menu,.fcc-edit-toast'))continue;
      if(el.id&&el.id.indexOf('mascom-founder')>=0)continue;
      if(el.id&&el.id.indexOf('mascom-footer')>=0)continue;
      var tag=el.tagName;

      // Text elements — always editable
      if(EDITABLE_TAGS.indexOf(tag)>=0){
        enableEdit(el);
        continue;
      }

      // Block elements — only if they directly contain text (not just child elements)
      if(EDITABLE_BLOCK_TAGS.indexOf(tag)>=0){
        var hasDirectText=false;
        for(var c=0;c<el.childNodes.length;c++){
          if(el.childNodes[c].nodeType===3&&el.childNodes[c].textContent.trim()){
            hasDirectText=true;break;
          }
        }
        if(hasDirectText)enableEdit(el);
      }
    }
  }

  function enableEdit(el){
    el.setAttribute('contenteditable','true');
    el.addEventListener('input',onEditInput);
    el.addEventListener('focus',function(){this.dataset.fccBefore=this.innerHTML;});
  }

  function onEditInput(){
    dirtyCount++;
    dirtyLabel.textContent=dirtyCount+' edit'+(dirtyCount>1?'s':'');
    document.getElementById('fcc-save-btn').disabled=false;
  }

  function exitFounderMode(){
    if(!founderModeActive)return;
    founderModeActive=false;

    // Remove contenteditable from all elements
    var editables=document.querySelectorAll('[contenteditable="true"]');
    for(var i=0;i<editables.length;i++){
      editables[i].removeAttribute('contenteditable');
      editables[i].removeEventListener('input',onEditInput);
    }

    // Remove UI
    document.body.classList.remove('fcc-editing');
    if(modeFrame&&modeFrame.parentNode)modeFrame.parentNode.removeChild(modeFrame);
    if(modeBar&&modeBar.parentNode)modeBar.parentNode.removeChild(modeBar);
    modeFrame=null;modeBar=null;dirtyLabel=null;dirtyCount=0;
  }

  function getCleanHTML(){
    // Clone document, strip all fcc-* elements and injected scripts/styles
    var clone=document.documentElement.cloneNode(true);
    var removes=clone.querySelectorAll('.fcc-mode-bar,.fcc-mode-frame,.fcc-overlay,.fcc-ctx-menu,.fcc-edit-toast,#mascom-founder-console,#mascom-founder-styles,#mascom-footer-styles,.mascom-footer,#mascom-fleet-services,#mascom-fleet-styles,.af-login-btn,.af-modal-overlay,.alhena-bubble,.alhena-chat,.mg-newsletter');
    for(var i=0;i<removes.length;i++)removes[i].parentNode.removeChild(removes[i]);
    // Strip contenteditable attributes
    var eds=clone.querySelectorAll('[contenteditable]');
    for(var j=0;j<eds.length;j++)eds[j].removeAttribute('contenteditable');
    // Strip data-fcc-* attributes
    var allEls=clone.querySelectorAll('*');
    for(var k=0;k<allEls.length;k++){
      var attrs=allEls[k].attributes;
      for(var a=attrs.length-1;a>=0;a--){
        if(attrs[a].name.indexOf('data-fcc')===0)allEls[k].removeAttribute(attrs[a].name);
      }
    }
    // Remove fcc-editing class from body
    var body=clone.querySelector('body');
    if(body)body.classList.remove('fcc-editing');
    return '<!DOCTYPE html>\n'+clone.outerHTML;
  }

  function saveChanges(){
    var btn=document.getElementById('fcc-save-btn');
    btn.disabled=true;btn.textContent='Saving...';

    var html=getCleanHTML();
    var path=location.pathname==='/'?'/index.html':location.pathname;
    if(!path.match(/\.[^/]+$$/))path=path+'.html';

    fetch('/api/founder/save',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        email:session.email,
        path:path,
        html:html,
        venture:currentVenture
      })
    }).then(function(r){return r.json();}).then(function(d){
      if(d.ok){
        btn.textContent='Saved!';btn.style.background='#22cc44';btn.style.color='#fff';
        dirtyCount=0;
        dirtyLabel.textContent='';
        showToast('Changes saved and live!');
        setTimeout(function(){
          btn.textContent='Save Changes';btn.style.background='';btn.style.color='';
          btn.disabled=true;
        },2000);
      }else{
        btn.disabled=false;btn.textContent='Save Changes';
        showToast('Save failed: '+(d.error||'unknown error'));
      }
    }).catch(function(){
      btn.disabled=false;btn.textContent='Save Changes';
      showToast('Network error — could not save');
    });
  }

  function revertChanges(){
    if(!confirm('Revert all edits to the original page?'))return;
    // Reload the page to get clean version
    location.reload();
  }

  function sendTask(){
    var input=document.getElementById('fcc-task-input');
    var task=input.value.trim();
    if(!task)return;
    var btn=document.getElementById('fcc-task-send');
    btn.disabled=true;btn.textContent='...';
    fetch('/api/founder/task',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        email:session.email,
        task:task,
        venture:currentVenture,
        context:{path:location.pathname,url:location.href}
      })
    }).then(function(r){return r.json();}).then(function(d){
      btn.disabled=false;btn.textContent='Send';
      if(d.ok){
        input.value='';
        showToast('Task sent to MASCOM: '+task.substring(0,50));
      }else{
        showToast('Failed: '+(d.error||'unknown'));
      }
    }).catch(function(){
      btn.disabled=false;btn.textContent='Send';
      showToast('Network error sending task');
    });
  }

  function showToast(msg){
    var t=document.createElement('div');
    t.className='fcc-edit-toast';
    t.textContent=msg;
    document.body.appendChild(t);
    requestAnimationFrame(function(){t.classList.add('show');});
    setTimeout(function(){t.classList.remove('show');setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},300);},2500);
  }
})();
</script><section id="pricing" style="max-width:1100px;margin:0 auto 60px;padding:40px 20px;text-align:center;">
