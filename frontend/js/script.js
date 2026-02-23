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
      "Onboard and monitor multiple companies.",
      "Track subscriptions and billing health.",
      "Audit global hiring activity and permissions."
    ],
    company_admin: [
      "Manage HR and hiring manager access.",
      "Approve or pause active job postings.",
      "Review company-wide funnel performance."
    ],
    hr: [
      "Create requisitions and publish job posts.",
      "Shortlist, screen, and move candidates.",
      "Coordinate interview schedules and updates."
    ],
    hiring_manager: [
      "Review shortlisted applications quickly.",
      "Approve/reject candidates with rationale.",
      "Track hiring pipeline and bottlenecks."
    ],
    interviewer: [
      "View all assigned interview slots.",
      "Submit structured evaluation forms.",
      "Rate candidate skills and culture fit."
    ],
    candidate: [
      "Discover roles by location and skill.",
      "Apply and track each application status.",
      "Maintain profile and resume versions."
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

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        event.stopPropagation();
        form.classList.add("was-validated");
        return;
      }

      form.classList.add("was-validated");
      const successMessage = form.querySelector("[data-form-success]");
      if (successMessage) {
        successMessage.classList.remove("d-none");
      }
      form.reset();
      form.classList.remove("was-validated");
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
})();
