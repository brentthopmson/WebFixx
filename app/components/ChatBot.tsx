import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { faTelegram } from '@fortawesome/free-brands-svg-icons'; // Import faTelegram from free-brands-svg-icons

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const telegramGroupLink = "https://t.me/your_telegram_group"; // Replace with actual Telegram group link

  return (
    <>
      {/* Chat Icon Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 z-50 lg:bottom-8 lg:right-8 dark:bg-blue-700 dark:hover:bg-blue-800"
        aria-label="Open chat"
      >
        <FontAwesomeIcon icon={faTelegram} className="w-6 h-6" /> {/* Use Telegram icon */}
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:bg-opacity-0 lg:pointer-events-none dark:bg-opacity-75"
            onClick={() => setIsOpen(false)}
          />

          {/* Chat Window */}
          <div className="fixed bottom-0 right-0 w-full h-[80vh] bg-white shadow-2xl rounded-t-2xl z-50 transition-all duration-300 ease-in-out lg:bottom-24 lg:right-8 lg:w-96 lg:h-[600px] lg:rounded-2xl dark:bg-gray-800 dark:shadow-none">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">WebFixx Support</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700"
                aria-label="Close chat"
              >
                <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Content - Telegram Group */}
            <div className="p-6 flex flex-col items-center justify-center h-[calc(100%-4rem)] text-center text-gray-600 dark:text-gray-300">
              <FontAwesomeIcon icon={faTelegram} className="w-16 h-16 text-blue-500 mb-4" />
              <h4 className="text-xl font-semibold mb-2 dark:text-white">Join Our Telegram Group!</h4>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                For immediate support, discussions, and updates, join our official Telegram community.
              </p>
              <a
                href={telegramGroupLink}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center space-x-2 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                <FontAwesomeIcon icon={faTelegram} className="w-5 h-5" />
                <span>Join Telegram</span>
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
