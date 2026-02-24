(function initApp() {
  // 1) Cache DOM references.
  const body = document.body;
  const navbar = document.querySelector(".app-navbar");
  const backToTop = document.querySelector("[data-back-to-top]");
  const sidebarToggle = document.querySelector("[data-sidebar-toggle]");
  const roleSelect = document.querySelector("[data-role-select]");
  const rolePreviewTitle = document.querySelector("[data-role-title]");
  const rolePreviewList = document.querySelector("[data-role-list]");
  const statCounters = document.querySelectorAll("[data-counter]");
  const activeLinks = document.querySelectorAll(".js-scroll-link[href^=\"#\"]");
  const observedSections = document.querySelectorAll("section[id]");

  // 2) Static display data.
  const rolePreviewMap = {
    platform_admin: [
      "Create and manage company accounts.",
      "Provision company admins and control access.",
      "Review global audit trails and platform operations."
    ],
    company_admin: [
      "Create HR, HiringManager, and Interviewer users.",
      "Manage company jobs, applications, and offers.",
      "Monitor company-only activity and ownership."
    ],
    hr: [
      "Create and submit requisitions for approval.",
      "Screen applications and manage candidate pipeline.",
      "Schedule interviews and send offers."
    ],
    hiring_manager: [
      "Approve or reject pending job approvals.",
      "Publish/close jobs after approval.",
      "Finalize hired or rejected decisions after offer acceptance."
    ],
    interviewer: [
      "Review assigned upcoming interviews.",
      "Submit technical and communication scorecards.",
      "Finalize scorecards to send outcomes to HR."
    ],
    candidate: [
      "Create account and complete profile.",
      "Apply to published jobs and track status updates.",
      "Accept or decline offers from the candidate portal."
    ]
  };

  // 3) Shared UI behavior.
  function onScrollEffects() {
    const offsetY = window.scrollY;

    if (navbar) {
      navbar.classList.toggle("navbar-shrink", offsetY > 60);
    }

    if (backToTop) {
      backToTop.classList.toggle("show", offsetY > 360);
    }
  }

  function bindNavigationHelpers() {
    if (backToTop) {
      backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    activeLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetId = link.getAttribute("href");
        if (!targetId || targetId === "#") return;
        const target = document.querySelector(targetId);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // 4) Section effects.
  function setupActiveSectionTracking() {
    if (!("IntersectionObserver" in window) || !activeLinks.length || !observedSections.length) return;

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute("id");
          if (!id) return;

          activeLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
          });
        });
      },
      {
        rootMargin: "-40% 0px -45% 0px",
        threshold: 0.01
      }
    );

    observedSections.forEach((section) => sectionObserver.observe(section));
  }

  function setupRevealAnimation() {
    const revealItems = document.querySelectorAll(".reveal");
    if (!revealItems.length) return;

    if (!("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("show"));
      return;
    }

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("show");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1 }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  }

  // 5) Forms and dashboard shell.
  function setupContactValidation() {
    const form = document.querySelector("[data-contact-form]");
    if (!form) return;

    const successMessage = form.querySelector("[data-form-success]");
    const submitButton = form.querySelector('button[type="submit"]');
    const fullNameInput = form.querySelector("#fullName");
    const emailInput = form.querySelector("#emailAddress");
    const companyInput = form.querySelector("#companyName");
    const roleInput = form.querySelector("#userRole");
    const messageInput = form.querySelector("#message");
    const agreeInput = form.querySelector("#agreeTerms");

    const API_BASE = String(window.PUBLIC_API_BASE || window.API_BASE || "http://localhost:3000").replace(/\/+$/, "");
    const CONTACT_PATH = "/contact-requests";

    const buildEndpoints = () => {
      const endpoints = [];
      const add = (value) => {
        if (!endpoints.includes(value)) endpoints.push(value);
      };
      add(`${API_BASE}${CONTACT_PATH}`);
      if (API_BASE.endsWith("/api")) {
        add(`${API_BASE.replace(/\/api$/, "")}${CONTACT_PATH}`);
      } else {
        add(`${API_BASE}/api${CONTACT_PATH}`);
      }
      return endpoints;
    };

    const endpoints = buildEndpoints();

    function setFormMessage(text, type = "success") {
      if (!successMessage) return;
      successMessage.textContent = text || "";
      successMessage.classList.remove("d-none", "text-success", "text-danger", "text-secondary");
      if (type === "error") {
        successMessage.classList.add("text-danger");
      } else if (type === "info") {
        successMessage.classList.add("text-secondary");
      } else {
        successMessage.classList.add("text-success");
      }
    }

    function setLoading(isLoading) {
      if (!submitButton) return;
      submitButton.disabled = isLoading;
      submitButton.textContent = isLoading ? "Sending..." : "Send Message";
    }

    async function submitContact(payload) {
      let lastError = new Error("Failed to submit contact request");

      for (let i = 0; i < endpoints.length; i += 1) {
        const endpoint = endpoints[i];
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload)
          });

          let data = null;
          try {
            data = await response.json();
          } catch (error) {
            data = null;
          }

          if (response.status === 404) {
            lastError = new Error(`Contact endpoint not found at ${endpoint}`);
            continue;
          }

          if (!response.ok) {
            const err = new Error(data?.message || `Contact request failed (${response.status})`);
            err.status = response.status;
            throw err;
          }

          return data || {};
        } catch (error) {
          lastError = error;
          if (Number(error?.status || 0) && Number(error.status) !== 404) {
            throw error;
          }
        }
      }

      throw lastError;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        event.stopPropagation();
        form.classList.add("was-validated");
        return;
      }

      form.classList.add("was-validated");
      setLoading(true);
      setFormMessage("Submitting your message...", "info");

      try {
        const payload = {
          full_name: String(fullNameInput?.value || "").trim(),
          work_email: String(emailInput?.value || "").trim(),
          company_name: String(companyInput?.value || "").trim(),
          role: String(roleInput?.value || "").trim(),
          message: String(messageInput?.value || "").trim(),
          agreed_to_contact: Boolean(agreeInput?.checked)
        };
        const result = await submitContact(payload);
        setFormMessage(result.message || "Message submitted successfully.", "success");
        form.reset();
        form.classList.remove("was-validated");
      } catch (error) {
        setFormMessage(error.message || "Failed to submit message.", "error");
      } finally {
        setLoading(false);
      }
    });
  }

  function setupSidebarToggle() {
    if (!sidebarToggle) return;
    sidebarToggle.addEventListener("click", () => {
      if (window.innerWidth < 992) {
        body.classList.toggle("dashboard-sidebar-open");
      } else {
        body.classList.toggle("dashboard-sidebar-collapsed");
      }
    });

    document.addEventListener("click", (event) => {
      if (window.innerWidth >= 992 || !body.classList.contains("dashboard-sidebar-open")) return;
      const sidebar = document.querySelector(".dash-sidebar");
      if (!sidebar) return;
      const clickedInsideSidebar = sidebar.contains(event.target);
      const clickedToggle = sidebarToggle.contains(event.target);
      if (!clickedInsideSidebar && !clickedToggle) {
        body.classList.remove("dashboard-sidebar-open");
      }
    });
  }

  function setupRolePreview() {
    if (!roleSelect || !rolePreviewTitle || !rolePreviewList) return;

    const updatePreview = () => {
      const selected = roleSelect.value;
      const features = rolePreviewMap[selected] || rolePreviewMap.hr;
      rolePreviewTitle.textContent = roleSelect.options[roleSelect.selectedIndex].text;
      rolePreviewList.innerHTML = "";
      features.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        rolePreviewList.appendChild(li);
      });
    };

    roleSelect.addEventListener("change", updatePreview);
    updatePreview();
  }

  // 6) Dashboard counters and charts.
  function animateCount(element) {
    const target = Number(element.dataset.counter || 0);
    const duration = 1500;
    const startTime = performance.now();

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = Math.floor(progress * target);
      element.textContent = value.toLocaleString();
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = target.toLocaleString();
      }
    };

    requestAnimationFrame(step);
  }

  function setupCounters() {
    if (!statCounters.length) return;
    if (!("IntersectionObserver" in window)) {
      statCounters.forEach((item) => animateCount(item));
      return;
    }

    const counterObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCount(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );

    statCounters.forEach((item) => counterObserver.observe(item));
  }

  function setupCharts() {
    if (typeof window.Chart === "undefined") return;
    // Dashboard pages render role-specific charts in their own scripts.
    if (document.body.classList.contains("dashboard-body")) return;

    const pipelineCanvas = document.getElementById("pipelineChart");
    if (pipelineCanvas) {
      // Hiring funnel progression by stage
      new Chart(pipelineCanvas, {
        type: "line",
        data: {
          labels: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"],
          datasets: [
            {
              label: "Qualified Candidates",
              data: [26, 34, 29, 41, 46],
              borderColor: "#4167df",
              backgroundColor: "rgba(65, 103, 223, 0.16)",
              tension: 0.35,
              fill: true
            },
            {
              label: "Interviews Completed",
              data: [12, 18, 19, 22, 28],
              borderColor: "#3da9fc",
              backgroundColor: "rgba(61, 169, 252, 0.12)",
              tension: 0.35,
              fill: true
            }
          ]
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom"
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }

    const sourceCanvas = document.getElementById("sourceChart");
    if (sourceCanvas) {
      // Candidate channel distribution
      new Chart(sourceCanvas, {
        type: "doughnut",
        data: {
          labels: ["Referrals", "LinkedIn", "Job Boards", "Career Site"],
          datasets: [
            {
              data: [28, 34, 22, 16],
              backgroundColor: ["#4167df", "#3da9fc", "#88a4ff", "#c9d6ff"],
              borderWidth: 1
            }
          ]
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom"
            }
          }
        }
      });
    }
  }

  function normalizeToken(value) {
    return String(value || "").trim().toLowerCase();
  }

  function classifyStatusChip(value) {
    const text = normalizeToken(value);
    if (!text) return "";

    if (
      text.includes("rejected") ||
      text.includes("declined") ||
      text.includes("failed") ||
      text.includes("cancelled") ||
      text.includes("deactivated")
    ) {
      return "hf-chip-danger";
    }

    if (text.includes("pending") || text.includes("screening")) {
      return "hf-chip-warning";
    }

    if (text.includes("selected")) {
      return "hf-chip-success-light";
    }

    if (
      text.includes("hired") ||
      text.includes("approved") ||
      text.includes("accepted") ||
      text.includes("published") ||
      text.includes("active") ||
      text.includes("completed")
    ) {
      return "hf-chip-success";
    }

    if (text.includes("closed") || text.includes("inactive") || text.includes("draft")) {
      return "hf-chip-neutral";
    }

    return "hf-chip-info";
  }

  function classifyActionChip(value) {
    const text = normalizeToken(value);
    if (!text) return "";

    if (
      text.includes("reject") ||
      text.includes("decline") ||
      text.includes("deactivate") ||
      text.includes("cancel") ||
      text.includes("fail")
    ) {
      return "hf-chip-danger";
    }

    if (text.includes("pending") || text.includes("submit") || text.includes("request")) {
      return "hf-chip-warning";
    }

    if (text.includes("select")) {
      return "hf-chip-success-light";
    }

    if (
      text.includes("hire") ||
      text.includes("approve") ||
      text.includes("accept") ||
      text.includes("publish") ||
      text.includes("activate") ||
      text.includes("complete") ||
      text.includes("sent offer")
    ) {
      return "hf-chip-success";
    }

    return "hf-chip-info";
  }

  function clearChipClasses(element) {
    const classes = [
      "hf-chip",
      "hf-chip-info",
      "hf-chip-warning",
      "hf-chip-danger",
      "hf-chip-success",
      "hf-chip-success-light",
      "hf-chip-neutral"
    ];
    classes.forEach((cls) => element.classList.remove(cls));
  }

  function applyChip(element, chipClass) {
    if (!element || !chipClass) return;
    clearChipClasses(element);
    element.classList.add("hf-chip", chipClass);
  }

  function getTableColumnKinds(table) {
    const kinds = [];
    const headerCells = table.querySelectorAll("thead th");
    headerCells.forEach((cell, index) => {
      const text = normalizeToken(cell.textContent);
      if (text.includes("status") || text.includes("decision")) {
        kinds[index] = "status";
      } else if (text.includes("action")) {
        kinds[index] = "action";
      }
    });
    return kinds;
  }

  function getTextTargetForCell(cell) {
    if (!cell) return null;
    if (cell.querySelector("button, input, select, textarea, a.btn")) return null;

    const existingBadge = cell.querySelector(".badge");
    if (existingBadge && cell.querySelectorAll(".badge").length === 1) {
      return existingBadge;
    }

    const existingChip = cell.querySelector(".hf-chip");
    if (existingChip && cell.querySelectorAll(".hf-chip").length === 1) {
      return existingChip;
    }

    if (cell.children.length > 0) return null;

    const plainText = String(cell.textContent || "").trim();
    if (!plainText) return null;

    cell.textContent = "";
    const span = document.createElement("span");
    span.textContent = plainText;
    cell.appendChild(span);
    return span;
  }

  function styleTableStatusesAndActions() {
    const tables = document.querySelectorAll(".table");
    tables.forEach((table) => {
      const kinds = getTableColumnKinds(table);
      if (!kinds.length) return;

      const bodyRows = table.querySelectorAll("tbody tr");
      bodyRows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        cells.forEach((cell, index) => {
          const kind = kinds[index];
          if (!kind) return;

          const target = getTextTargetForCell(cell);
          if (!target) return;
          const value = String(target.textContent || "").trim();
          if (!value || value === "-" || value === "N/A") return;

          const chipClass = kind === "status" ? classifyStatusChip(value) : classifyActionChip(value);
          if (!chipClass) return;
          applyChip(target, chipClass);
        });
      });
    });
  }

  function setupStatusActionStyling() {
    styleTableStatusesAndActions();

    let queued = false;
    const scheduleStyle = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        styleTableStatusesAndActions();
      });
    };

    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i += 1) {
        const mutation = mutations[i];
        if (mutation.type === "childList" || mutation.type === "characterData") {
          scheduleStyle();
          return;
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true
    });
  }

  // 7) Final boot sequence.
  window.addEventListener("scroll", onScrollEffects);
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 992) {
      body.classList.remove("dashboard-sidebar-open");
    }
  });

  onScrollEffects();
  bindNavigationHelpers();
  setupActiveSectionTracking();
  setupRevealAnimation();
  setupContactValidation();
  setupSidebarToggle();
  setupRolePreview();
  setupCounters();
  setupCharts();
  setupStatusActionStyling();
})();
