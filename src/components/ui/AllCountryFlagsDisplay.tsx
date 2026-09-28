import React from 'react';
import { countries } from '@/data/countries_complete';

const AllCountryFlagsDisplay = () => {
  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold text-center mb-8 text-white">All {countries.length} Country Flags</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {countries.map((country) => (
          <div 
            key={country.code} 
            className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center justify-center border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105"
          >
            <div className="text-4xl mb-2">{country.emoji}</div>
            <div className="text-center text-white text-sm font-medium break-words max-w-[80px]">
              {country.name}
            </div>
            <div className="text-center text-gray-300 text-xs mt-1">
              {country.code}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center text-white/80">
        <p>Total Countries: {countries.length}</p>
      </div>
    </div>
  );
};

export default AllCountryFlagsDisplay;