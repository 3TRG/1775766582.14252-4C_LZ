document.addEventListener("DOMContentLoaded", function () {
  const menuItems = document.querySelectorAll(".main-menu-item");

  if (!menuItems.length) return;

  const currentPage = getCurrentPageName();

  menuItems.forEach(function (item) {
    const targetPage = item.dataset.page;

    if (!targetPage) return;

    if (targetPage === currentPage) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }

    item.addEventListener("click", function () {
      if (targetPage === currentPage) return;
      window.location.href = targetPage;
    });
  });
});

function getCurrentPageName() {
  const path = window.location.pathname;
  const fileName = path.substring(path.lastIndexOf("/") + 1);
  return fileName || "chat.html";
}