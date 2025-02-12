import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { getAllListEvent } from "../../../../store/calendar/thunkscalendar";
import { useLocation, useNavigate } from "react-router-dom";
import Filters from "./Filters";
import EventTable from "./EventTable";
import Pagination from "./Pagination";
import ExportButton from "./ExportButton";
import DateRangeSelector from "./DateRangeSelector";

export const View_events_list = () => {
     const dispatch = useDispatch();
     const location = useLocation();
     const navigate = useNavigate();

     const [events, setEvents] = useState([]);
     const [dateStart, setDateStart] = useState("");
     const [dateEnd, setDateEnd] = useState("");
     const [loading, setLoading] = useState(false);

     // Pagination state
     const [itemsPerPage, setItemsPerPage] = useState(10);
     const [currentPage, setCurrentPage] = useState(1);

     // Original events data fetched from the server
     const [originalEvents, setOriginalEvents] = useState([]);

     useEffect(() => {
          const today = new Date();
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
          const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

          const searchParams = new URLSearchParams(location.search);
          const isToday = searchParams.get("data") === "1";

          if (isToday) {
               const todayString = today.toISOString().split("T")[0];
               setDateStart(todayString);
               setDateEnd(todayString);
          } else {
               setDateStart(firstDay.toISOString().split("T")[0]);
               setDateEnd(lastDay.toISOString().split("T")[0]);
          }
     }, [location]);

     useEffect(() => {
          const fetchData = async () => {
               setLoading(true);
               if (dateStart && dateEnd) {
                    const eventsData = await dispatch(getAllListEvent(dateStart, dateEnd));

                    const sortedEvents = eventsData.sort((a, b) => new Date(b.fechaIni_calendar) - new Date(a.fechaIni_calendar));
                    setOriginalEvents(sortedEvents);
                    setEvents(sortedEvents);
                    setCurrentPage(1);
               }
               setLoading(false);
          };
          fetchData();
     }, [dispatch, dateStart, dateEnd]);

     const handleEventClick = (idCalendar, idLead) => {
          navigate(`/events/actions?idCalendar=${idCalendar}&idLead=${idLead}&idDate=0`);
     };

     const currentEvents = events.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

     return (
          <div>
               <ExportButton events={events} />
               <DateRangeSelector dateStart={dateStart} dateEnd={dateEnd} setDateStart={setDateStart} setDateEnd={setDateEnd} />
               <Filters originalEvents={originalEvents} setEvents={setEvents} />
               {loading ? <div>Cargando...</div> : <EventTable events={currentEvents} handleEventClick={handleEventClick} />}
               <Pagination
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    totalItems={events.length}
                    setCurrentPage={setCurrentPage}
                    setItemsPerPage={setItemsPerPage}
               />
          </div>
     );
};
