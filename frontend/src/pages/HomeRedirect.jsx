import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function HomeRedirect() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
      return;
    }

    if (user.role === "donor") {
      navigate("/donor", { replace: true });
    } else if (user.role === "recipient") {
      navigate("/recipient", { replace: true });
    } else if (user.role === "admin") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate, user]);

  return null;
}

export default HomeRedirect;
