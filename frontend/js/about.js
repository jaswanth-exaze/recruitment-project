/**
 * About page enhancements.
 * Keeps behavior isolated from the generic site script.
 *
 * Beginner Reading Guide:
 * 1) Find elements on the About page.
 * 2) Add small animation delays for timeline/cards.
 * 3) Add hover effect for CTA buttons.
 * 4) Exit safely when the page does not contain these elements.
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
