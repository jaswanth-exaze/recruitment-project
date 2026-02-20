/**
 * About page enhancements.
 * Keeps behavior isolated from the generic site script.
 */

(function initAboutPage() {
  const timelineItems = document.querySelectorAll(".timeline-item");
  const overviewCards = document.querySelectorAll("#overview .feature-card");
  const ctaButtons = document.querySelectorAll(".highlight-panel a");

  if (!timelineItems.length && !overviewCards.length && !ctaButtons.length) return;

  timelineItems.forEach((item, index) => {
    item.style.transitionDelay = `${index * 70}ms`;
  });

  overviewCards.forEach((card, index) => {
    card.style.transitionDelay = `${index * 90}ms`;
  });

  ctaButtons.forEach((button) => {
    button.addEventListener("mouseenter", () => {
      button.classList.add("shadow");
    });
    button.addEventListener("mouseleave", () => {
      button.classList.remove("shadow");
    });
  });
})();
