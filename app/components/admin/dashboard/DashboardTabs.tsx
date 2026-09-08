const CATEGORY_LABELS: Record<string, string> = {
  WIRE: 'MAIL',
  BANK: 'BANK',
  SOCIAL: 'SOCIAL',
};

interface DashboardTabsProps {
  categories: ('WIRE' | 'BANK' | 'SOCIAL')[];
  activeCategory: 'WIRE' | 'BANK' | 'SOCIAL' | null;
  onCategoryChange: (category: 'WIRE' | 'BANK' | 'SOCIAL') => void;
}

export const DashboardTabs: React.FC<DashboardTabsProps> = ({
  categories,
  activeCategory,
  onCategoryChange,
}) => {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <nav className="-mb-px flex space-x-8">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
              ${activeCategory === category
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}
            `}
          >
            {CATEGORY_LABELS[category] || category}
          </button>
        ))}
      </nav>
    </div>
  );
};
