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

const Notification = {
  show: (message, type = 'success') => {
    console.warn('Notification.show is deprecated. Use UIComponents.Notification.show instead.');
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
    const textColor = type === 'success' ? 'text-green-800' : 'text-red-800';
    
    notification.className = `fixed top-4 right-4 max-w-sm w-full ${bgColor} border rounded-lg p-4 shadow-lg animate-slide-up z-50`;
    notification.innerHTML = `
      <div class="flex">
        <div class="flex-1">
          <p class="${textColor} text-sm font-medium">${message}</p>
        </div>
        <button class="ml-3 text-gray-400 hover:text-gray-600" onclick="this.closest('div').remove()">
          <span class="sr-only">Close</span>
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
    
    return notification;
  }
};

// Export for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Modal, Notification };
} else {
  window.Components = { Modal, Notification };
} 