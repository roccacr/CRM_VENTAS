import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { restoreSession } from "../store/auth/authThunksMicrosoft";


/**
 * Restaura sesión al cargar app usando cache segura de MSAL.
 *
 * @returns {string} Estado actual de autenticación.
 */
export const useCheckAuth = () => {
  const dispatch = useDispatch();
  const { status } = useSelector((state) => state.auth);

  useEffect(() => {
    console.log("[useCheckAuth] dispatch restoreSession");
    dispatch(restoreSession());
  }, [dispatch]);

  useEffect(() => {
    console.log("[useCheckAuth] status changed", { status });
  }, [status]);

  return status;
};
