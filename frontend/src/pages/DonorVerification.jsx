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
  const [paymentNumber, setPaymentNumber] = useState("");
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const rowsPerPage = 5;

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFileData({ name: file.name, content: reader.result });
    reader.readAsDataURL(file);
  };

  const openPaymentModal = () => {
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
  };

  const confirmPayment = () => {
    if (!paymentNumber.trim()) {
      return toast.error("Enter your payment phone number");
    }

    setPayContact(paymentNumber);
    setPaid(true);
    setShowPaymentModal(false);
    toast.success("Payment recorded successfully");
  };

  const submitApplication = async () => {
    if (!fileData) return toast.error("Please upload a verification document");
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
          paid
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
    <div className="register-page">
      <div className="register-content">
        <div className="register-card">
          <h2>Apply for Donor Verification</h2>

          <label style={{ textAlign: 'left', width: '100%', marginBottom: 6 }}>Type</label>
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
            <input type="file" onChange={handleFile} />
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" onClick={openPaymentModal}>
              Pay {formatUGX(50000)}
            </button>
            <button type="button" className="btn-primary" onClick={submitApplication} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>

          <div className="register-card">
          <h3>Application history</h3>
          <p style={{ marginTop: 6, marginBottom: 18, fontSize: 13, color: '#666' }}>
            Review your submitted verification application and current status here.
          </p>
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
                    <td>{item.type}</td>
                    <td>{item.documentName}</td>
                    <td>{item.provider}</td>
                    <td>{item.paymentNumber}</td>
                    <td>{renderVerificationStatus(item.status)}</td>
                    <td>{item.amount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '16px 8px', textAlign: 'center' }}>
                    No application history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

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
                  { value: "MTN", label: "MTN" },
                  { value: "Airtel", label: "Airtel" }
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
                <button type="button" className="btn-primary" onClick={confirmPayment}>
                  Confirm Payment
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
