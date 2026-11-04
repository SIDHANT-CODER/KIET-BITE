const loginForm = document.querySelector("#login-form");

if (!(loginForm instanceof HTMLFormElement)) {
  throw new Error("The login form could not be found.");
}

const loginStatus = loginForm.querySelector("#login-status");
const signupLink = loginForm.querySelector(".login-signup a");

if (!(loginStatus instanceof HTMLElement) || !(signupLink instanceof HTMLAnchorElement)) {
  throw new Error("The login status message could not be found.");
}

const orderCourt = new URLSearchParams(window.location.search).get("orderCourt");
const validCourtId = /^[a-z]+(?:-[a-z]+)*$/;
if (orderCourt && validCourtId.test(orderCourt)) {
  signupLink.href = `signup.html?orderCourt=${encodeURIComponent(orderCourt)}`;
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const submitButton = loginForm.querySelector('button[type="submit"]');
  if (!(submitButton instanceof HTMLButtonElement)) {
    throw new Error("The login button could not be found.");
  }

  const emailInput = loginForm.elements.namedItem("email");
  const passwordInput = loginForm.elements.namedItem("password");
  if (!(emailInput instanceof HTMLInputElement) || !(passwordInput instanceof HTMLInputElement)) {
    throw new Error("The login form is missing a required field.");
  }

  submitButton.disabled = true;
  loginStatus.textContent = "Signing in…";

  fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      email: emailInput.value,
      password: passwordInput.value
    })
  })
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not sign in.");
      }

      window.location.assign(orderCourt && validCourtId.test(orderCourt)
        ? `court-menu.html?court=${encodeURIComponent(orderCourt)}`
        : "/index.html");
    })
    .catch((error) => {
      loginStatus.textContent = error instanceof TypeError
        ? "Could not connect to KITE Bite. Make sure the app server is running."
        : error.message;
    })
    .finally(() => {
      submitButton.disabled = false;
    });
});
