// store/selectorsHome.js
import { createSelector } from "reselect";

// Selector para obtener el estado de Home
const selectHomeState = (state) => state.home;

// Selector memoizado para obtener listEventsPending
export const selectListEventsPending = createSelector([selectHomeState], (home) => home.listEventsPending);

// Obtener el estado home
export const selectListNew = createSelector(
    [selectHomeState],
    (home) => home.listNew
);

export const selectListAttention = createSelector(
    [selectHomeState],
    (home) => home.listAttention
);

export const selectListEvents = createSelector(
    [selectHomeState],
    (home) => home.listEvents
);

export const selectListOportunity = createSelector(
    [selectHomeState],
    (home) => home.listOportunity
);

export const selectListOrderSale = createSelector(
    [selectHomeState],
    (home) => home.listOrderSale
);

export const selectListOrderSalePending = createSelector(
    [selectHomeState],
    (home) => home.listOrderSalePending
);



export const selectlistGraficoKpi = createSelector(
    [selectHomeState],
    (home) => home.listGraficoKpi || []
);

