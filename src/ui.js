export function setButtonLoading(button, loading, text) {
  button.disabled = loading;
  button.textContent = loading ? text : button.dataset.label;
}
