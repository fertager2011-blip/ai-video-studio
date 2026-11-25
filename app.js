const screens = ["home","projects","create","plan","preview","status"];
const $ = (id) => document.getElementById(id);
let selectedFile = null;
let currentProject = null;
let projects = JSON.parse(localStorage.getItem("aivs_projects") || "[]");
let previewUrl = null;

function show(name) {
  screens.forEach(s => $(s + "Screen").classList.toggle("active", s === name));
  document.querySelectorAll(".nav-item").forEach(b =>
    b.classList.toggle("active", b.dataset.go === name || (name === "status" && b.dataset.go === "home") || (name === "projects" && b.dataset.go === "home"))
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function persist() {
  localStorage.setItem("aivs_projects", JSON.stringify(projects));
  renderProjects();
}

function projectCard(p) {
  return `<article class="project-card">
    <div class="project-card-info">
      <strong>${escapeHtml(p.name || "Без названия")}</strong>
      <small>${escapeHtml(p.duration || "Длительность не определена")} · ${escapeHtml(p.created || "")}</small>
      <span class="pill">${escapeHtml(p.status || "Черновик")}</span>
    </div>
    <button class="delete-project-btn" type="button" data-delete-project="${escapeHtml(p.id)}" aria-label="Удалить проект">Удалить</button>
  </article>`;
}

function emptyProjects() {
  return '<div class="empty"><div class="empty-icon">▧</div><strong>Пока нет проектов</strong><p>Создайте первый проект, выбрав видео из галереи.</p></div>';
}

function renderProjects() {
  $("projectCount").textContent = projects.length;
  $("readyCount").textContent = projects.filter(p => p.status === "Готово").length;

  const recentList = $("projectList");
  const allList = $("allProjectList");
  const newestFirst = projects.slice().reverse();

  recentList.innerHTML = newestFirst.length
    ? newestFirst.slice(0, 3).map(projectCard).join("")
    : emptyProjects();

  allList.innerHTML = newestFirst.length
    ? newestFirst.map(projectCard).join("")
    : emptyProjects();

  $("viewAllProjectsBtn").hidden = projects.length === 0;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function deleteProject(projectId) {
  const project = projects.find(item => String(item.id) === String(projectId));
  if (!project) return;

  const confirmed = window.confirm(`Удалить проект «${project.name || "Без названия"}»? Это действие нельзя отменить.`);
  if (!confirmed) return;

  projects = projects.filter(item => String(item.id) !== String(projectId));
  if (currentProject && String(currentProject.id) === String(projectId)) currentProject = null;
  persist();
}

function handleProjectListClick(event) {
  const button = event.target.closest("[data-delete-project]");
  if (!button) return;
  deleteProject(button.dataset.deleteProject);
}

$("newProjectBtn").addEventListener("click", () => show("create"));
$("viewAllProjectsBtn").addEventListener("click", () => show("projects"));
$("projectList").addEventListener("click", handleProjectListClick);
$("allProjectList").addEventListener("click", handleProjectListClick);

document.querySelectorAll("[data-go]").forEach(button =>
  button.addEventListener("click", () => show(button.dataset.go))
);

$("videoFile").addEventListener("change", () => {
  selectedFile = $("videoFile").files[0] || null;
  $("fileLabel").textContent = selectedFile ? selectedFile.name : "Выбрать видео из галереи";
  const video = $("videoPreview");

  if (previewUrl) URL.revokeObjectURL(previewUrl);

  if (selectedFile) {
    previewUrl = URL.createObjectURL(selectedFile);
    video.src = previewUrl;
    video.hidden = false;
  } else {
    video.hidden = true;
    video.removeAttribute("src");
  }
});

$("analyzeBtn").addEventListener("click", () => {
  if (!selectedFile) {
    alert("Сначала выберите видео из галереи.");
    return;
  }

  const instruction = $("instruction").value.trim();
  if (!instruction) {
    alert("Напишите, что нужно изменить в видео.");
    return;
  }

  const name = selectedFile.name.replace(/\.[^.]+$/, "") || "Новый проект";
  currentProject = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    instruction,
    fileName: selectedFile.name,
    duration: "Длительность будет проверена сервером",
    created: new Date().toLocaleDateString("ru-RU"),
    status: "Черновик · план ожидает подтверждения"
  };

  projects.push(currentProject);
  persist();
  show("plan");
});

$("approvePlanBtn").addEventListener("click", () => {
  if (!currentProject) return;
  currentProject.planNote = $("planNote").value.trim();
  currentProject.status = "Ожидает согласования стиля";
  persist();
  show("preview");
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
  if (!note) {
    alert("Напишите, что нужно изменить.");
    return;
  }
  alert("Замечание сохранено только в этом демонстрационном интерфейсе. Генерация контрольных кадров пока не подключена.");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {})
  );
}

renderProjects();
