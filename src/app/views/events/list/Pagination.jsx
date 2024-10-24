import React from "react";

const Pagination = ({ currentPage, itemsPerPage, totalItems, setCurrentPage, setItemsPerPage }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    const handleItemsPerPageChange = (e) => {
        setItemsPerPage(parseInt(e.target.value));
        setCurrentPage(1);
    };

    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
    }

    return (
        <div style={{ marginTop: "20px", textAlign: "center" }}>
            {pageNumbers.map((number) => (
                <button
                    key={number}
                    onClick={() => handlePageChange(number)}
                    style={{
                        margin: "0 5px",
                        padding: "5px 10px",
                        backgroundColor: number === currentPage ? "#007bff" : "#fff",
                        color: number === currentPage ? "#fff" : "#007bff",
                        border: "1px solid #007bff",
                        borderRadius: "5px",
                        cursor: "pointer",
                    }}
                >
                    {number}
                </button>
            ))}
            <div className="date-filters" style={{ marginBottom: "20px" }}>
                <label style={{ marginLeft: "20px" }}>
                    Items por página:
                    <select value={itemsPerPage} onChange={handleItemsPerPageChange} className="form-control" style={{ marginLeft: "10px" }}>
                        <option value={10}>10</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </label>
            </div>
        </div>
    );
};

export default Pagination;
