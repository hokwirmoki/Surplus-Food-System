import { useState, useEffect } from "react";
import API from "../services/api";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiClock, FiXCircle } from "react-icons/fi";
import { formatUGX } from "../utils/formatMoney";
import SelectMenu from "../components/SelectMenu";
import "../styles/register.css";

function DonorVerification() {
  const navigate = useNavigate();
  const [vendorType, setVendorType] = useState("individual");
  const [fileData, setFileData] = useState(null);
  const [payContact, setPayContact] = useState("");
  const [paid, setPaid] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState("MTN");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentNumber, setPaymentNumber] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const rowsPerPage = 5;

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      e.target.value = "";
      setFileData(null);
      toast.error("Only PDF documents are accepted for verification.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setFileData({ name: file.name, type: file.type, content: reader.result });
    reader.readAsDataURL(file);
  };

  const openPaymentModal = () => {
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
  };

  const confirmPayment = async () => {
    if (!paymentNumber.trim()) {
      return toast.error("Enter your payment phone number");
    }

    try {
      setPaymentLoading(true);
      const paymentRes = await API.post("/payments/sandbox", {
        provider: paymentProvider,
        phone: paymentNumber,
        amount: 50000,
        purpose: "verification",
        metadata: { vendorType },
      });

      setPayContact(paymentRes.data.payment.phone);
      setPaymentReference(paymentRes.data.payment.reference);
      setPaid(true);
      setShowPaymentModal(false);
      toast.success(`${paymentProvider} sandbox payment successful`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Payment failed");
    } finally {
      setPaymentLoading(false);
    }
  };

  const submitApplication = async () => {
    if (!fileData) return toast.error("Please upload a PDF verification document");
    if (!paid) return toast.error(`Please pay ${formatUGX(50000)} before submitting your application`);

    const token = localStorage.getItem("token");
    if (!token) return toast.error("You must be logged in to submit your application");

    setLoading(true);
    try {
      const res = await API.post(
        "/user/donor/verify",
        {
          vendorType,
          document: fileData,
          paymentProvider,
          paymentContact: payContact,
          paid,
          paymentReference
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const updatedUser = res.data.user;
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setHistory([{
        id: updatedUser.id,
        type: updatedUser.documents?.type || vendorType,
        documentName: updatedUser.documents?.document?.name || 'Uploaded document',
        provider: updatedUser.documents?.paymentProvider || paymentProvider,
        paymentNumber: updatedUser.documents?.paymentContact || payContact,
        status: updatedUser.verification_status || 'pending',
        amount: formatUGX(50000)
      }]);

      toast.success("Verification application submitted");
      navigate("/donor");
    } catch (err) {
      toast.error(err.response?.data?.message || "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  const renderVerificationStatus = (status) => {
    if (status === "verified") {
      return (
        <span className="status verified">
          <FiCheckCircle className="status-icon status-icon--verified" /> Verified
        </span>
      );
    }

    if (status === "pending") {
      return (
        <span className="status pending">
          <FiClock className="status-icon status-icon--pending" /> Pending
        </span>
      );
    }

    return (
      <span className="status unverified">
        <FiXCircle className="status-icon status-icon--unverified" /> Unverified
      </span>
    );
  };

  useEffect(() => {
    const loadCurrentUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const res = await API.get("/user/me", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const loadedUser = res.data.user;

        if (loadedUser.documents) {
          setHistory([{
            id: loadedUser.id,
            type: loadedUser.documents.type || 'N/A',
            documentName: loadedUser.documents.document?.name || 'Uploaded document',
            provider: loadedUser.documents.paymentProvider || 'N/A',
            paymentNumber: loadedUser.documents.paymentContact || 'N/A',
            status: loadedUser.verification_status || 'unverified',
            amount: formatUGX(50000)
          }]);
        }
      } catch (err) {
        console.error('Failed to load user history', err);
      }
    };

    loadCurrentUser();
  }, []);

  const pageCount = Math.max(1, Math.ceil(history.length / rowsPerPage));
  const displayedHistory = history.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <div className="register-page verification-page">
      <div className="register-content verification-content">
        <div className="register-card verification-form-card">
          <h2>Apply for Donor Verification</h2>

          <label className="form-label compact-label">Type</label>
          <SelectMenu
            value={vendorType}
            onChange={setVendorType}
            options={[
              { value: "institution", label: "Institution (Hotel / Restaurant)" },
              { value: "individual", label: "Individual (Vendor)" }
            ]}
          />

          <label className="form-label">Upload Document</label>
          <label className="file-upload-control">
            <span>{fileData?.name || "Choose file"}</span>
            <input type="file" accept="application/pdf,.pdf" onChange={handleFile} />
          </label>

          <div className="verification-actions">
            <button type="button" className="btn-secondary" onClick={openPaymentModal}>
              {paid ? "Payment Complete" : `Pay ${formatUGX(50000)}`}
            </button>
            <button type="button" className="btn-primary" onClick={submitApplication} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>

          <div className="register-card verification-history-card">
          <h3>Application history</h3>
          <p className="verification-history-copy">
            Review your submitted verification application and current status here.
          </p>
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Document</th>
                  <th>Provider</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {displayedHistory.length > 0 ? (
                  displayedHistory.map((item, index) => (
                    <tr key={`${item.id}-${index}`}>
                      <td data-label="Type">{item.type}</td>
                      <td data-label="Document">{item.documentName}</td>
                      <td data-label="Provider">{item.provider}</td>
                      <td data-label="Phone">{item.paymentNumber}</td>
                      <td data-label="Status">{renderVerificationStatus(item.status)}</td>
                      <td data-label="Amount">{item.amount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="empty-history-cell">
                      No application history found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination-container">
            <button
              type="button"
              className="pagination-button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span className="pagination-info">Page {page} of {pageCount}</span>
            <button
              type="button"
              className="pagination-button"
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              disabled={page === pageCount}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="payment-modal">
          <div className="payment-modal-card">
            <h3>Complete Payment</h3>
            <div className="payment-modal-body">
              <label>Service provider</label>
              <SelectMenu
                value={paymentProvider}
                onChange={setPaymentProvider}
                options={[
                  { value: "MTN", label: "MTN", className: "payment-option-mtn" },
                  { value: "Airtel", label: "Airtel", className: "payment-option-airtel" }
                ]}
              />

              <label>Phone number</label>
              <input
                className="payment-modal-input"
                type="tel"
                value={paymentNumber}
                onChange={(e) => setPaymentNumber(e.target.value)}
                placeholder="e.g. 0777123456"
              />

              <label>Amount</label>
              <input
                className="payment-modal-input"
                type="text"
                value={formatUGX(50000)}
                readOnly
              />

              <div className="payment-modal-actions">
                <button type="button" className="btn-secondary" onClick={closePaymentModal}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={confirmPayment} disabled={paymentLoading}>
                  {paymentLoading ? "Processing..." : "Confirm Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DonorVerification;
