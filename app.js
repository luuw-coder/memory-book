(() => {
"use strict";
const DB_NAME="memory-book-db", DB_VERSION=1, STORE="records";
const DEFAULT_CATEGORIES=[
  {id:"general",name:"Khác",icon:"📁"},
  {id:"ideas",name:"Ý tưởng",icon:"💡"},
  {id:"study",name:"Học tập",icon:"📚"},
  {id:"coding",name:"Lập trình",icon:"💻"},
  {id:"scripts",name:"Kịch bản",icon:"🎬"},
  {id:"design",name:"Thiết kế",icon:"🎨"},
  {id:"important",name:"Ghi nhớ quan trọng",icon:"⭐"}
];
let db, notes=[], categories=DEFAULT_CATEGORIES.map(x=>({...x})), currentId=null, currentView="all", sortMode="updated", layout="grid", saveTimer=null, categoryEditId=null;
const $=id=>document.getElementById(id);
const els={
  grid:$("notesGrid"),list:$("listView"),editor:$("editorView"),settings:$("settingsView"),tags:$("tagsView"),
  title:$("noteTitle"),body:$("noteBody"),category:$("noteCategory"),tagsInput:$("noteTags"),saveState:$("saveState")
};
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:"key"});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function storeGet(key){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly"),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result?.value);r.onerror=()=>reject(r.error);});}
function storeSet(key,value){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put({key,value});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);}
function now(){return new Date().toISOString();}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200);}
function safeText(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function plain(html=""){const d=document.createElement("div");d.innerHTML=html;return d.textContent||"";}
function fmt(date){if(!date)return"";return new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(date));}
function activeNotes(){return notes.filter(n=>!n.deletedAt);}
function getCategory(id){return categories.find(c=>c.id===id)||categories[0];}
async function persistAll(){await storeSet("notes",notes);await storeSet("categories",categories);}
async function init(){try{db=await openDB();notes=await storeGet("notes")||[];categories=await storeGet("categories")||DEFAULT_CATEGORIES.map(x=>({...x}));}catch(e){console.error(e);alert("Không thể mở IndexedDB. Hãy thử trình duyệt khác hoặc kiểm tra chế độ riêng tư.");return;}
  bind();applySettings();render();showView("all");}
function bind(){
  $("newNoteBtn").onclick=$("headingNewBtn").onclick=$("emptyNewBtn").onclick=createNote;
  $("backBtn").onclick=()=>showView(currentView==="editor"?"all":currentView);
  $("searchInput").addEventListener("input",render);
  $("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");
  $("themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("mb-dark",document.body.classList.contains("dark"));$("darkToggle").checked=document.body.classList.contains("dark");};
  $("darkToggle").onchange=e=>{document.body.classList.toggle("dark",e.target.checked);localStorage.setItem("mb-dark",e.target.checked);};
  $("fontSize").onchange=e=>{localStorage.setItem("mb-font",e.target.value);els.body.style.fontSize=e.target.value+"px";};
  $("density").onchange=e=>{localStorage.setItem("mb-density",e.target.value);els.grid.style.gap=e.target.value==="compact"?"9px":"16px";};
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
  document.querySelectorAll("[data-sort]").forEach(b=>b.onclick=()=>{sortMode=b.dataset.sort;document.querySelectorAll("[data-sort]").forEach(x=>x.classList.toggle("active",x===b));render();});
  document.querySelectorAll("[data-layout]").forEach(b=>b.onclick=()=>{layout=b.dataset.layout;els.grid.classList.toggle("list-layout",layout==="list");document.querySelectorAll("[data-layout]").forEach(x=>x.classList.toggle("selected",x===b));});
  $("addCategoryBtn").onclick=()=>openCategoryDialog();
  $("categoryForm").onsubmit=saveCategory;
  $("noteTitle").oninput=$("noteTags").oninput=queueSave;
  $("noteCategory").onchange=queueSave;
  $("noteBody").addEventListener("input",()=>{updateWordCount();queueSave();});
  document.querySelectorAll("[data-command]").forEach(b=>b.onclick=()=>{els.body.focus();document.execCommand(b.dataset.command,false,b.dataset.value||null);queueSave();});
  $("pinBtn").onclick=()=>toggleFlag("pinned");$("favoriteBtn").onclick=()=>toggleFlag("favorite");
  $("deleteBtn").onclick=deleteCurrent;$("duplicateBtn").onclick=duplicateCurrent;
  $("exportBtn").onclick=exportBackup;$("importFile").onchange=importBackup;
  $("sortBtn").onclick=()=>{sortMode=sortMode==="updated"?"created":sortMode==="created"?"oldest":"updated";document.querySelectorAll("[data-sort]").forEach(x=>x.classList.toggle("active",x.dataset.sort===sortMode));render();};
  document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("searchInput").focus();}if(e.key==="Escape")$("sidebar").classList.remove("open");});
}
function applySettings(){const dark=localStorage.getItem("mb-dark")==="true";document.body.classList.toggle("dark",dark);$("darkToggle").checked=dark;const f=localStorage.getItem("mb-font")||"17";$("fontSize").value=f;els.body.style.fontSize=f+"px";const d=localStorage.getItem("mb-density")||"comfortable";$("density").value=d;els.grid.style.gap=d==="compact"?"9px":"16px";}
function showView(view){currentView=view;els.list.classList.toggle("hidden",!["all","pinned","favorites","recent","trash","category"].includes(view));els.editor.classList.add("hidden");els.settings.classList.toggle("hidden",view!=="settings");els.tags.classList.toggle("hidden",view!=="tags");$("sidebar").classList.remove("open");if(view==="editor")return;
  const labels={all:"Tất cả văn bản",pinned:"Đã ghim",favorites:"Yêu thích",recent:"Gần đây",trash:"Thùng rác",settings:"Cài đặt",tags:"Thẻ Tags",category:"Danh mục"};
  $("pageTitle").textContent=labels[view]||"Tất cả văn bản";$("breadcrumb").innerHTML=`Không gian của bạn <span>/</span> ${safeText(labels[view]||"Danh mục")}`;
  document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  if(view==="settings")renderStats();if(view==="tags")renderTags();render();
}
function createNote(){const n={id:uid(),title:"",body:"",categoryId:"general",tags:[],pinned:false,favorite:false,createdAt:now(),updatedAt:now(),deletedAt:null};notes.unshift(n);persistAll().then(()=>openEditor(n.id));}
function openEditor(id){currentId=id;const n=notes.find(x=>x.id===id);if(!n)return;showEditorOnly();els.title.value=n.title;els.body.innerHTML=n.body;els.tagsInput.value=(n.tags||[]).join(", ");renderCategorySelect(n.categoryId);$("createdAt").textContent="Tạo ngày "+fmt(n.createdAt);$("pinBtn").style.opacity=n.pinned?"1":".45";$("favoriteBtn").textContent=n.favorite?"★":"☆";$("favoriteBtn").style.color=n.favorite?"#c58d35":"";updateWordCount();els.saveState.textContent="Đã lưu";}
function showEditorOnly(){els.list.classList.add("hidden");els.settings.classList.add("hidden");els.tags.classList.add("hidden");els.editor.classList.remove("hidden");$("breadcrumb").innerHTML=`Không gian của bạn <span>/</span> Đang chỉnh sửa`;}
function renderCategorySelect(selected){els.category.innerHTML=categories.map(c=>`<option value="${safeText(c.id)}" ${c.id===selected?"selected":""}>${safeText(c.icon)} ${safeText(c.name)}</option>`).join("");}
function queueSave(){if(!currentId)return;els.saveState.textContent="Đang lưu…";clearTimeout(saveTimer);saveTimer=setTimeout(saveCurrent,350);}
async function saveCurrent(){const n=notes.find(x=>x.id===currentId);if(!n)return;n.title=els.title.value.trim();n.body=els.body.innerHTML;n.categoryId=els.category.value;n.tags=[...new Set(els.tagsInput.value.split(",").map(x=>x.trim()).filter(Boolean))];n.updatedAt=now();try{await persistAll();els.saveState.textContent="Đã lưu";renderCounts();}catch(e){els.saveState.textContent="Lỗi lưu";console.error(e);toast("Không thể lưu dữ liệu.");}}
function updateWordCount(){const words=plain(els.body.innerHTML).trim().split(/\s+/).filter(Boolean).length;$("wordCount").textContent=words+" từ";}
function toggleFlag(flag){const n=notes.find(x=>x.id===currentId);if(!n)return;n[flag]=!n[flag];persistAll();openEditor(n.id);render();}
async function deleteCurrent(){const n=notes.find(x=>x.id===currentId);if(!n)return;if(!confirm("Chuyển văn bản này vào thùng rác?"))return;n.deletedAt=now();await persistAll();toast("Đã chuyển vào thùng rác");showView("all");}
async function duplicateCurrent(){const n=notes.find(x=>x.id===currentId);if(!n)return;const copy={...n,id:uid(),title:(n.title||"Văn bản không tên")+" (bản sao)",createdAt:now(),updatedAt:now(),deletedAt:null};notes.unshift(copy);await persistAll();toast("Đã nhân bản văn bản");openEditor(copy.id);}
function renderCounts(){$("countAll").textContent=activeNotes().length;$("countTrash").textContent=notes.filter(n=>n.deletedAt).length;}
function render(){if(currentView==="settings"||currentView==="tags"||currentView==="editor")return;const q=$("searchInput").value.trim().toLocaleLowerCase("vi");let arr=notes.filter(n=>currentView==="trash"?!!n.deletedAt:!n.deletedAt);
  if(currentView==="pinned")arr=arr.filter(n=>n.pinned);if(currentView==="favorites")arr=arr.filter(n=>n.favorite);if(currentView==="recent")arr=arr.filter(n=>Date.now()-new Date(n.updatedAt)<7*86400000);if(currentView==="category")arr=arr.filter(n=>n.categoryId===window.selectedCategoryId);
  if(q)arr=arr.filter(n=>(n.title+" "+plain(n.body)+" "+(n.tags||[]).join(" ")+" "+getCategory(n.categoryId).name).toLocaleLowerCase("vi").includes(q));
  arr.sort((a,b)=>sortMode==="created"?new Date(b.createdAt)-new Date(a.createdAt):sortMode==="oldest"?new Date(a.createdAt)-new Date(b.createdAt):new Date(b.updatedAt)-new Date(a.updatedAt));
  els.grid.innerHTML=arr.map(n=>{const c=getCategory(n.categoryId);const preview=plain(n.body).slice(0,170)||"Chưa có nội dung...";return `<article class="note-card" data-id="${safeText(n.id)}"><div class="card-top"><span class="category-pill">${safeText(c.icon)} ${safeText(c.name)}</span><span class="card-icons">${n.pinned?"📌 ":""}${n.favorite?"★":""}</span></div><h3>${safeText(n.title||"Văn bản không có tiêu đề")}</h3><div class="note-preview">${safeText(preview)}</div><div class="tag-list">${(n.tags||[]).slice(0,3).map(t=>`<span class="tag">#${safeText(t)}</span>`).join("")}</div><div class="card-bottom"><span>${fmt(n.updatedAt)}</span>${currentView==="trash"?`<button class="secondary-btn restore-btn" data-restore="${safeText(n.id)}">Khôi phục</button>`:"<span>↗ Mở văn bản</span>"}</div></article>`;}).join("");
  els.grid.classList.toggle("list-layout",layout==="list");$("emptyState").classList.toggle("hidden",arr.length>0);els.grid.classList.toggle("hidden",arr.length===0);
  els.grid.querySelectorAll(".note-card").forEach(card=>card.onclick=e=>{if(e.target.closest("[data-restore]"))return;openEditor(card.dataset.id);});
  els.grid.querySelectorAll("[data-restore]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const n=notes.find(x=>x.id===b.dataset.restore);n.deletedAt=null;n.updatedAt=now();await persistAll();render();toast("Đã khôi phục văn bản");});
  renderCounts();
}
function renderCategories(){const box=$("categoryList");box.innerHTML=categories.filter(c=>c.id!=="general").map(c=>`<button class="nav-item" data-category="${safeText(c.id)}"><span>${safeText(c.icon)}</span>${safeText(c.name)}<b>${activeNotes().filter(n=>n.categoryId===c.id).length}</b></button>`).join("");box.querySelectorAll("[data-category]").forEach(b=>b.onclick=()=>{window.selectedCategoryId=b.dataset.category;showView("category");$("pageTitle").textContent=b.textContent.trim();});}
function openCategoryDialog(id=null){categoryEditId=id;const c=categories.find(x=>x.id===id);$("categoryDialogTitle").textContent=id?"Sửa danh mục":"Thêm danh mục";$("categoryName").value=c?.name||"";$("categoryIcon").value=c?.icon||"📁";$("categoryDialog").showModal();}
async function saveCategory(e){e.preventDefault();const name=$("categoryName").value.trim(),icon=$("categoryIcon").value.trim()||"📁";if(!name)return;if(categoryEditId){const c=categories.find(x=>x.id===categoryEditId);c.name=name;c.icon=icon;}else categories.push({id:uid(),name,icon});await persistAll();$("categoryDialog").close();renderCategories();render();toast("Đã lưu danh mục");}
function renderTags(){const counts={};activeNotes().forEach(n=>(n.tags||[]).forEach(t=>counts[t]=(counts[t]||0)+1));$("tagsCloud").innerHTML=Object.entries(counts).sort((a,b)=>a[0].localeCompare(b[0])).map(([t,c])=>`<button class="tag-cloud-item" data-tag="${safeText(t)}">#${safeText(t)} <span>${c}</span></button>`).join("")||"<p class='subheading'>Chưa có Tags. Thêm Tags trong trình chỉnh sửa văn bản.</p>";$("tagsCloud").querySelectorAll("[data-tag]").forEach(b=>b.onclick=()=>{showView("all");$("searchInput").value=b.dataset.tag;render();});}
function renderStats(){$("statNotes").textContent=activeNotes().length;$("statCategories").textContent=categories.length;$("statTrash").textContent=notes.filter(n=>n.deletedAt).length;const bytes=new Blob([JSON.stringify({notes,categories})]).size;$("storageSize").textContent=bytes<1024?bytes+" B":(bytes/1024).toFixed(1)+" KB";}
function exportBackup(){const payload={app:"Memory Book",version:1,exportedAt:now(),notes,categories};download("memory-book-backup.json",JSON.stringify(payload,null,2),"application/json");toast("Đã xuất bản sao lưu");}
function download(name,data,type){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
async function importBackup(e){const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data||!Array.isArray(data.notes)||!Array.isArray(data.categories))throw new Error("Sai cấu trúc");if(!confirm(`Nhập ${data.notes.length} văn bản và ${data.categories.length} danh mục? Dữ liệu hiện tại sẽ bị thay thế.`))return;notes=data.notes;categories=data.categories;await persistAll();renderCategories();render();renderStats();toast("Đã nhập bản sao lưu");}catch(err){alert("Không thể nhập file: cấu trúc JSON không hợp lệ.");}finally{e.target.value="";}}
async function cleanupTrash(){const trash=notes.filter(n=>n.deletedAt);if(!trash.length)return;if(!confirm(`Xóa vĩnh viễn ${trash.length} văn bản trong thùng rác?`))return;notes=notes.filter(n=>!n.deletedAt);await persistAll();render();toast("Đã dọn thùng rác");}
init();
})();