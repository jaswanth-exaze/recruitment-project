/**
 * About page enhancements.
 * Keeps behavior isolated from the generic site script.
 */

(function initAboutPage() {
  // 1) Collect elements.
  const timelineItems = document.querySelectorAll(".timeline-item");
  const overviewCards = document.querySelectorAll("#overview .feature-card");
  const ctaButtons = document.querySelectorAll(".highlight-panel a");

  if (!timelineItems.length && !overviewCards.length && !ctaButtons.length) return;

  // 2) Apply staggered animation delays.
  timelineItems.forEach((item, index) => {
    item.style.transitionDelay = `${index * 70}ms`;
  });

  overviewCards.forEach((card, index) => {
    card.style.transitionDelay = `${index * 90}ms`;
  });

  // 3) Bind CTA hover feedback.
  ctaButtons.forEach((button) => {
    button.addEventListener("mouseenter", () => {
      button.classList.add("shadow");
    });
    button.addEventListener("mouseleave", () => {
      button.classList.remove("shadow");
    });
  });
})();
