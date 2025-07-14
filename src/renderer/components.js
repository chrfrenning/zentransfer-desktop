/**
 * Legacy Components File
 * This file is kept for backward compatibility but functionality
 * has been moved to the new modular structure in components/ui-components.js
 * 
 * @deprecated Use UIComponents from components/ui-components.js instead
 */

// Simple backward compatibility layer
const Modal = {
  create: (content) => {
    console.warn('Modal.create is deprecated. Use UIComponents.Modal.create instead.');
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 overflow-y-auto';
    modal.innerHTML = `
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity animate-fade-in"></div>
        <div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg animate-slide-up">
          <div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            ${content}
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button type="button" class="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:ml-3 sm:w-auto" onclick="this.closest('.fixed').remove()">
              Close
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }
};



// Export for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Modal };
} else {
  window.Components = { Modal };
} 