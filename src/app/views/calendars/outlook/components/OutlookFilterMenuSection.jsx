import React from "react";

const FilterToggleButton = ({ label, selected, onClick, subtitle = "" }) => (
    <button
        aria-pressed={selected}
        className={`outlook-calendar-check ${selected ? "is-selected" : "is-unselected"}`}
        onClick={onClick}
        type="button"
    >
        <span className="outlook-check-indicator">
            {selected && <span className="ti ti-check"></span>}
        </span>
        <span className="outlook-check-label-wrap">
            <span className="outlook-check-label">{label}</span>
            {subtitle ? <span className="outlook-check-subtitle">{subtitle}</span> : null}
        </span>
    </button>
);

export const OutlookFilterMenuSection = ({ title, options, selectedMap, onToggle }) => {
    if (!options.length) {
        return null;
    }

    return (
        <div className="outlook-filter-menu-section">
            <h3>{title}</h3>
            {options.map((option) => (
                <FilterToggleButton
                    key={option.value}
                    label={option.label}
                    onClick={() => onToggle(option.value)}
                    selected={selectedMap[option.value] === true}
                    subtitle={option.subtitle}
                />
            ))}
        </div>
    );
};
