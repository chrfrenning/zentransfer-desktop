/**
 * UI Components Library
 * Reusable UI components for the ZenTransfer app
 */

import { config } from '../config/app-config.js';

export class UIComponents {
    
    /**
     * Modal Component
     */
    static Modal = {
        create: (content, options = {}) => {
            const {
                title = '',
                showCloseButton = true,
                size = 'md',
                onClose = null
            } = options;

            const sizeClasses = {
                sm: 'sm:max-w-sm',
                md: 'sm:max-w-lg',
                lg: 'sm:max-w-2xl',
                xl: 'sm:max-w-4xl'
            };

            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-50 overflow-y-auto';
            modal.innerHTML = `
                <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity animate-fade-in" onclick="this.closest('.fixed').remove()"></div>
                    <div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full ${sizeClasses[size]} animate-slide-up">
                        ${title ? `
                            <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-200">
                                <h3 class="text-lg font-medium leading-6 text-gray-900">${title}</h3>
                            </div>
                        ` : ''}
                        <div class="bg-white px-4 pb-4 pt-5 sm:p-6 ${title ? 'sm:pt-4' : ''}">
                            ${content}
                        </div>
                        ${showCloseButton ? `
                            <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                                <button type="button" class="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:ml-3 sm:w-auto" onclick="this.closest('.fixed').remove()">
                                    Close
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;

            // Add close handler
            if (onClose) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal || e.target.classList.contains('bg-opacity-75')) {
                        onClose();
                    }
                });
            }

            document.body.appendChild(modal);
            return modal;
        },

        confirm: (message, options = {}) => {
            return new Promise((resolve) => {
                const {
                    title = 'Confirm Action',
                    confirmText = 'Confirm',
                    cancelText = 'Cancel',
                    type = 'warning'
                } = options;

                const typeColors = {
                    warning: 'bg-yellow-600 hover:bg-yellow-500',
                    danger: 'bg-red-600 hover:bg-red-500',
                    info: 'bg-blue-600 hover:bg-blue-500'
                };

                const content = `
                    <div class="sm:flex sm:items-start">
                        <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                            <p class="text-sm text-gray-500">${message}</p>
                        </div>
                    </div>
                `;

                const modal = UIComponents.Modal.create(content, {
                    title,
                    showCloseButton: true
                });

                // Replace the close button with custom buttons
                const buttonContainer = modal.querySelector('.bg-gray-50');
                if (buttonContainer) {
                    buttonContainer.innerHTML = `
                        <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                            <button type="button" class="inline-flex w-full justify-center rounded-md ${typeColors[type]} px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto" id="confirmBtn">
                                ${confirmText}
                            </button>
                            <button type="button" class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto" id="cancelBtn">
                                ${cancelText}
                            </button>
                        </div>
                    `;
                } else {
                    // Fallback: create button container if it doesn't exist
                    const modalContent = modal.querySelector('.relative.transform');
                    if (modalContent) {
                        const buttonDiv = document.createElement('div');
                        buttonDiv.className = 'bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6';
                        buttonDiv.innerHTML = `
                            <button type="button" class="inline-flex w-full justify-center rounded-md ${typeColors[type]} px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto" id="confirmBtn">
                                ${confirmText}
                            </button>
                            <button type="button" class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto" id="cancelBtn">
                                ${cancelText}
                            </button>
                        `;
                        modalContent.appendChild(buttonDiv);
                    }
                }

                modal.querySelector('#confirmBtn').onclick = () => {
                    modal.remove();
                    resolve(true);
                };

                modal.querySelector('#cancelBtn').onclick = () => {
                    modal.remove();
                    resolve(false);
                };
            });
        }
    };



    /**
     * Loading Component
     */
    static Loading = {
        show: (message = 'Loading...', options = {}) => {
            const {
                overlay = true,
                size = 'md'
            } = options;

            const sizeClasses = {
                sm: 'h-6 w-6',
                md: 'h-8 w-8',
                lg: 'h-12 w-12'
            };

            const loader = document.createElement('div');
            loader.id = 'globalLoader';
            loader.className = `fixed inset-0 ${overlay ? 'bg-white bg-opacity-90' : ''} flex flex-col items-center justify-center z-50`;
            loader.innerHTML = `
                <div class="text-center">
                    <svg class="animate-spin ${sizeClasses[size]} text-primary-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p class="text-gray-600 text-sm">${message}</p>
                </div>
            `;
            
            document.body.appendChild(loader);
            return loader;
        },

        hide: () => {
            const loader = document.getElementById('globalLoader');
            if (loader) {
                loader.remove();
            }
        }
    };

    /**
     * Progress Bar Component
     */
    static ProgressBar = {
        create: (options = {}) => {
            const {
                value = 0,
                max = 100,
                showLabel = true,
                size = 'md',
                color = 'primary'
            } = options;

            const sizeClasses = {
                sm: 'h-2',
                md: 'h-3',
                lg: 'h-4'
            };

            const colorClasses = {
                primary: 'bg-primary-600',
                success: 'bg-green-600',
                warning: 'bg-yellow-600',
                danger: 'bg-red-600'
            };

            const percentage = Math.round((value / max) * 100);

            const progressBar = document.createElement('div');
            progressBar.className = 'w-full';
            progressBar.innerHTML = `
                ${showLabel ? `
                    <div class="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>${percentage}%</span>
                    </div>
                ` : ''}
                <div class="w-full bg-gray-200 rounded-full ${sizeClasses[size]}">
                    <div class="${colorClasses[color]} ${sizeClasses[size]} rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
                </div>
            `;

            progressBar.update = (newValue) => {
                const newPercentage = Math.round((newValue / max) * 100);
                const bar = progressBar.querySelector(`.${colorClasses[color]}`);
                const label = progressBar.querySelector('span:last-child');
                
                if (bar) bar.style.width = `${newPercentage}%`;
                if (label) label.textContent = `${newPercentage}%`;
            };

            return progressBar;
        }
    };

    /**
     * Button Component
     */
    static Button = {
        create: (text, options = {}) => {
            const {
                type = 'primary',
                size = 'md',
                disabled = false,
                loading = false,
                onClick = null,
                icon = null
            } = options;

            const typeClasses = {
                primary: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white',
                secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
                success: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white',
                danger: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white',
                outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700'
            };

            const sizeClasses = {
                sm: 'px-3 py-1.5 text-sm',
                md: 'px-4 py-2 text-sm',
                lg: 'px-6 py-3 text-base'
            };

            const button = document.createElement('button');
            button.type = 'button';
            button.disabled = disabled || loading;
            button.className = `
                inline-flex items-center justify-center font-semibold rounded-lg
                transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl
                disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                ${typeClasses[type]} ${sizeClasses[size]}
            `.trim();

            button.innerHTML = `
                ${loading ? `
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ` : icon ? `${icon}` : ''}
                ${text}
            `;

            if (onClick) {
                button.addEventListener('click', onClick);
            }

            return button;
        }
    };

    /**
     * Secure Input Component
     * Creates input fields with toggle visibility for sensitive data
     */
    static SecureInput = {
        create: (options = {}) => {
            const {
                id = '',
                placeholder = '',
                value = '',
                label = '',
                required = false
            } = options;

            const container = document.createElement('div');
            container.className = 'space-y-2';
            
            container.innerHTML = `
                ${label ? `<label for="${id}" class="block text-sm font-medium text-gray-700">${label}${required ? ' <span class="text-red-500">*</span>' : ''}</label>` : ''}
                <div class="relative">
                    <input 
                        type="password" 
                        id="${id}"
                        class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm" 
                        placeholder="${placeholder}"
                        value="${value}"
                        ${required ? 'required' : ''}
                    >
                    <button 
                        type="button" 
                        class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                        onclick="UIComponents.SecureInput.toggleVisibility('${id}')"
                    >
                        <!-- Eye icon (hidden state) -->
                        <svg id="${id}_eye_hidden" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        <!-- Eye slash icon (visible state) -->
                        <svg id="${id}_eye_visible" class="h-5 w-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                        </svg>
                    </button>
                </div>
            `;

            return container;
        },

        toggleVisibility: (inputId) => {
            const input = document.getElementById(inputId);
            const eyeHidden = document.getElementById(`${inputId}_eye_hidden`);
            const eyeVisible = document.getElementById(`${inputId}_eye_visible`);

            if (input && eyeHidden && eyeVisible) {
                if (input.type === 'password') {
                    input.type = 'text';
                    eyeHidden.classList.add('hidden');
                    eyeVisible.classList.remove('hidden');
                } else {
                    input.type = 'password';
                    eyeHidden.classList.remove('hidden');
                    eyeVisible.classList.add('hidden');
                }
            }
        }
    };
}

// Export for use in other modules
export default UIComponents;

// Make UIComponents globally accessible for HTML onclick handlers
if (typeof window !== 'undefined') {
    window.UIComponents = UIComponents;
} 