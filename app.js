const screens = ["home","create","plan","preview","status"];
const $ = (id) => document.getElementById(id);
let selectedFile = null;
let currentProject = null;
let projects = JSON.parse(localStorage.getItem("aivs_projects") || "[]");
let previewUrl = null;

function show(name) {
  screens.forEach(s => $(s+"Screen").classList.toggle("active", s === name));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.go === name || (name === "status" && b.dataset.go === "home")));
  window.scrollTo({top:0,behavior:"smooth"});
}
function persist() { localStorage.setItem("aivs_projects", JSON.stringify(projects)); renderProjects(); }
function renderProjects() {
  $("projectCount").textContent = projects.length;
  $("readyCount").textContent = projects.filter(p => p.status === "Готово").length;
  const list = $("projectList");
  if (!projects.length) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">▧</div><strong>Пока нет проектов</strong><p>Создайте первый проект, выбрав видео из галереи.</p></div>';
    return;
  }
  list.innerHTML = projects.slice().reverse().map(p => `<article class="project-card"><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.duration || "Длительность не определена")} · ${escapeHtml(p.created)}</small></div><span class="pill">${escapeHtml(p.status)}</span></article>`).join("");
}
function escapeHtml(v) { return String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function durationLabel(seconds) {
  if (!Number.isFinite(seconds)) return "Длительность не определена";
  const m = Math.floor(seconds/60), s = Math.floor(seconds%60);
  return `${m}:${String(s).padStart(2,"0")}`;
}
$("newProjectBtn").addEventListener("click", () => show("create"));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => show(b.dataset.go)));
$("videoFile").addEventListener("change", () => {
  selectedFile = $("videoFile").files[0] || null;
  $("fileLabel").textContent = selectedFile ? selectedFile.name : "Выбрать видео из галереи";
  const video = $("videoPreview");
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  if (selectedFile) {
    previewUrl = URL.createObjectURL(selectedFile);
    video.src = previewUrl;
    video.hidden = false;
  } else { video.hidden = true; video.removeAttribute("src"); }
});
$("analyzeBtn").addEventListener("click", () => {
  if (!selectedFile) { alert("Сначала выберите видео из галереи."); return; }
  const instruction = $("instruction").value.trim();
  if (!instruction) { alert("Напишите, что нужно изменить в видео."); return; }
  const name = selectedFile.name.replace(/\.[^.]+$/, "") || "Новый проект";
  currentProject = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name, instruction, fileName:selectedFile.name,
    duration: "Длительность будет проверена сервером",
    created: new Date().toLocaleDateString("ru-RU"),
    status:"Черновик · план ожидает подтверждения"
  };
  projects.push(currentProject); persist(); show("plan");
});
$("approvePlanBtn").addEventListener("click", () => {
  if (!currentProject) return;
  currentProject.planNote = $("planNote").value.trim();
  currentProject.status = "Ожидает согласования стиля";
  persist(); show("preview");
});
$("approveStyleBtn").addEventListener("click", () => {
  if (!currentProject) return;
  currentProject.styleNote = $("styleNote").value.trim();
  currentProject.status = "Макет согласован · сервер не подключён";
  persist();
  $("statusTitle").textContent = currentProject.name;
  $("statusLabel").textContent = "Ожидает подключения сервера";
  show("status");
});
$("requestStyleBtn").addEventListener("click", () => {
  const note = $("styleNote").value.trim();
  if (!note) { alert("Напишите, что нужно изменить."); return; }
  alert("Замечание сохранено только в этом демонстрационном интерфейсе. Генерация контрольных кадров пока не подключена.");
});
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
renderProjects();