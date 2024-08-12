import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { startLoadingLeads } from "../store/leads/thunksLeads";


export const useLoadLeads = () => {
    const dispatch = useDispatch();
    const list = useSelector((state) => state.lead.list);

    useEffect(() => {
        if (list.length === 0) {
            dispatch(startLoadingLeads());
        }
    }, [list, dispatch]);

    return list;
};
