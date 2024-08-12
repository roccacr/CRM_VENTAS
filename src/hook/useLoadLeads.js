import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { startLoadingLeads } from "../store/leads/thunksLeads";


export const useLoadLeads = () => {
    const dispatch = useDispatch();
    const listHome = useSelector((state) => state.lead.listHome);

    useEffect(() => {
        if (listHome.length === 0) {
            dispatch(startLoadingLeads());
        }
    }, [listHome, dispatch]);

    return listHome;
};
