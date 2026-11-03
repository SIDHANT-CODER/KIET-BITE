const signupForm = document.querySelector("#signup-form");

if (!(signupForm instanceof HTMLFormElement)) {
  throw new Error("The sign-up form could not be found.");
}

const passwordInput = signupForm.querySelector("#password");
const confirmPasswordInput = signupForm.querySelector("#confirm-password");
const signupStatus = signupForm.querySelector("#signup-status");

if (
  !(passwordInput instanceof HTMLInputElement) ||
  !(confirmPasswordInput instanceof HTMLInputElement) ||
  !(signupStatus instanceof HTMLElement)
) {
  throw new Error("The sign-up form is missing a required field.");
}

function validatePasswordMatch() {
  const passwordsMatch =
    confirmPasswordInput.value === "" || passwordInput.value === confirmPasswordInput.value;
  confirmPasswordInput.setCustomValidity(passwordsMatch ? "" : "Passwords do not match.");
  return passwordsMatch;
}

passwordInput.addEventListener("input", validatePasswordMatch);
confirmPasswordInput.addEventListener("input", validatePasswordMatch);

signupForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!validatePasswordMatch()) {
    confirmPasswordInput.reportValidity();
    return;
  }

  const submitButton = signupForm.querySelector('button[type="submit"]');
  if (!(submitButton instanceof HTMLButtonElement)) {
    throw new Error("The sign-up button could not be found.");
  }

  submitButton.disabled = true;
  signupStatus.textContent = "Creating your account…";

  fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      name: signupForm.elements.namedItem("name").value,
      email: signupForm.elements.namedItem("email").value,
      password: passwordInput.value
    })
  })
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not create your account.");
      }

      signupStatus.textContent = `Account created, ${result.user.name}. You are signed in.`;
      signupForm.reset();
    })
    .catch((error) => {
      signupStatus.textContent = error instanceof TypeError
        ? "Could not connect to KITE Bite. Make sure the app server is running."
        : error.message;
    })
    .finally(() => {
      submitButton.disabled = false;
    });
});
