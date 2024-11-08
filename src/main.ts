document.addEventListener("DOMContentLoaded", () => {
    const button = document.createElement("button");
    button.textContent = "Click Here!";
    document.body.appendChild(button);
  
    button.addEventListener("click", () => {
      alert("Welcome to Demo 3");
    });
  });
  