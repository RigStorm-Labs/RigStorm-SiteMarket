/* RigStorm SiteMarket — shared interactions
   Theme toggle, mobile nav, reveal-on-scroll, forms (mailto-based). */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- Theme ---------- */
  function getStored() {
    try { return localStorage.getItem("sitemarket-theme"); } catch (e) { return null; }
  }
  function setTheme(mode) {
    root.setAttribute("data-theme", mode);
    try { localStorage.setItem("sitemarket-theme", mode); } catch (e) {}
    var btns = document.querySelectorAll(".theme-toggle");
    btns.forEach(function (b) {
      b.setAttribute("aria-pressed", mode === "light" ? "true" : "false");
      b.setAttribute("aria-label", mode === "light" ? "Switch to dark mode" : "Switch to light mode");
    });
    // Swap logo sources for browsers with cached pre-JS paint
    document.querySelectorAll(".brand img, .f-logo").forEach(function (img) {
      var dark = img.getAttribute("data-dark");
      var light = img.getAttribute("data-light");
      if (!dark || !light) return;
      img.src = mode === "light" ? light : dark;
    });
  }
  function currentTheme() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  }
  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTheme(currentTheme() === "light" ? "dark" : "light");
    });
  });
  // Keep in sync if OS theme changes and user has no stored preference
  try {
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", function (e) {
      if (!getStored()) setTheme(e.matches ? "light" : "dark");
    });
  } catch (e) {}

  /* ---------- Mobile nav ---------- */
  var menuBtn = document.querySelector(".menu-btn");
  var mobileNav = document.getElementById("mobileNav");
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", function () {
      var open = mobileNav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.textContent = open ? "✕" : "☰";
    });
    mobileNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        mobileNav.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.textContent = "☰";
      });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  try {
    var els = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && els.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("visible");
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.12 });
      els.forEach(function (el) { io.observe(el); });
    } else {
      els.forEach(function (el) { el.classList.add("visible"); });
    }
  } catch (e) {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- Forms: validate -> compose email -> show confirmation ----------
     Static hosting has no backend, so the enquiry is handed to the visitor's
     email client addressed to the correct SiteMarket inbox. No data is stored. */
  function handleForm(formId, opts) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var err = form.querySelector(".form-error");
      if (err) err.textContent = "";

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var fd = new FormData(form);
      var lines = opts.lines(fd, form);
      var subject = opts.subject(fd);
      var body = lines.join("\n");
      var href = "mailto:" + opts.to +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);

      window.location.href = href;

      var ok = document.getElementById(opts.successId);
      if (ok) {
        ok.classList.add("show");
        ok.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (opts.altContact) {
        var alt = ok ? ok.querySelector("[data-alt-email]") : null;
        if (alt) alt.textContent = opts.to;
      }
    });
  }

  handleForm("contactForm", {
    to: "rigstormlabs@gmail.com",
    successId: "contactSuccess",
    subject: function (fd) {
      return "Website enquiry — " + (fd.get("name") || "New enquiry") +
        " (" + (fd.get("projectType") || "general") + ")";
    },
    lines: function (fd) {
      return [
        "Name: " + fd.get("name"),
        "Email: " + fd.get("email"),
        "Phone / WhatsApp: " + (fd.get("phone") || "—"),
        "Business: " + (fd.get("business") || "—"),
        "Project type: " + (fd.get("projectType") || "—"),
        "",
        "What they need:",
        String(fd.get("message") || "—"),
        "",
        "— Sent from the SiteMarket contact page"
      ];
    }
  });

  /* ---------- Custom Quote form: Formspree + in-page confirmation ----------
     Submits via fetch so the visitor never leaves the SiteMarket page.
     Prevents duplicate submissions while a request is in flight. */
  (function initQuoteForm() {
    var form = document.getElementById("quoteForm");
    if (!form) return;
    var endpoint = form.getAttribute("action") || "https://formspree.io/f/mbgleplw";
    var submitBtn = document.getElementById("quoteSubmit") || form.querySelector('[type="submit"]');
    var errBox = document.getElementById("quoteError") || form.querySelector(".form-error");
    var okBox = document.getElementById("quoteSuccess");
    var againBtn = document.getElementById("quoteAgain");
    var sending = false;
    var idleLabel = submitBtn ? submitBtn.innerHTML : "";

    function setSending(on) {
      sending = on;
      if (!submitBtn) return;
      submitBtn.disabled = on;
      submitBtn.setAttribute("aria-disabled", on ? "true" : "false");
      submitBtn.innerHTML = on ? "Sending… please wait" : idleLabel;
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (sending) return;
      if (errBox) errBox.textContent = "";
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      setSending(true);
      fetch(endpoint, {
        method: "POST",
        body: new FormData(form),
        headers: { "Accept": "application/json" }
      }).then(function (res) {
        if (!res.ok) throw new Error("Submission failed with status " + res.status);
        return res.json().catch(function () { return {}; });
      }).then(function () {
        form.style.display = "none";
        if (okBox) {
          okBox.classList.add("show");
          okBox.scrollIntoView({ behavior: "smooth", block: "center" });
          if (okBox.hasAttribute("tabindex")) okBox.focus({ preventScroll: true });
        }
      }).catch(function () {
        if (errBox) {
          errBox.textContent = "Something went wrong while sending your request. Please check your connection and try again — or email us directly at rigstormlabs@gmail.com.";
          errBox.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }).then(function () {
        // Re-enable unless the form was replaced by the success state
        if (form.style.display !== "none") setSending(false);
        else if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = idleLabel; sending = false; }
      });
    });

    if (againBtn) {
      againBtn.addEventListener("click", function () {
        form.reset();
        setSending(false);
        if (okBox) okBox.classList.remove("show");
        form.style.display = "";
        form.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  })();
})();
