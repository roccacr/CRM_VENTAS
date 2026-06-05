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
    dispatch(restoreSession());
  }, [dispatch]);

  return status;
};
