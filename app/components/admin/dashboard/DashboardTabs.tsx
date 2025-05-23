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
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
              ${activeCategory === category
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            {category}
          </button>
        ))}
      </nav>
    </div>
  );
};