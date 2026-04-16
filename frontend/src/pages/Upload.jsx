/**
 * pages/Upload.jsx
 */
import { useState, useRef } from "react";
import { Upload as UploadIcon, FileText, CheckCircle, AlertTriangle, Download } from "lucide-react";
import { uploadApi, exportApi } from "../utils/api";
import toast from "react-hot-toast";

export default function Upload() {
  const [dragging, setDragging] = useState(false);
  const [file,     setFile]     = useState(null);
  const [type,     setType]     = useState("sales");
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith(".csv")) { toast.error("Only CSV files supported"); return; }
    setFile(f);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await uploadApi.dataset(file, type);
      setResult(res.data);
      toast.success(`Imported ${res.data.inserted} records`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Import Data</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Upload CSV datasets from Kaggle or internal systems. Currency auto-detection converts USD → ₹
        </p>
      </div>

      {/* Dataset type */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-700 mb-3">Dataset Type</h2>
        <div className="flex gap-3">
          {["sales","products"].map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                type === t
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {t === "sales" ? "📊 Sales History" : "📦 Products Catalog"}
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}
        className={`card p-10 flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed transition-all ${
          dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
        }`}
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />
        <UploadIcon size={36} className={dragging ? "text-blue-500" : "text-slate-300"} />
        {file ? (
          <div className="text-center">
            <p className="font-semibold text-blue-700">{file.name}</p>
            <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · CSV</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-semibold text-slate-600">Drop CSV file here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">Supports Kaggle, Supermarket, Retail datasets</p>
          </div>
        )}
      </div>

      {file && !result && (
        <div className="flex justify-end">
          <button onClick={handleUpload} disabled={loading} className="btn-primary">
            <UploadIcon size={15} />
            {loading ? "Importing…" : `Import ${type === "sales" ? "Sales" : "Products"}`}
          </button>
        </div>
      )}

      {result && (
        <div className="card p-5 border border-green-200 bg-green-50">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={20} className="text-green-600" />
            <h2 className="font-semibold text-green-800">Import Complete</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Rows",  value: result.total   || 0 },
              { label: "Inserted",    value: result.inserted || 0 },
              { label: "Skipped",     value: result.skipped  || 0 },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl p-3 text-center border border-green-100">
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export section */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Download size={17} /> Export Reports
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Products CSV",   href: exportApi.productsCsv(),  color: "btn-secondary" },
            { label: "Sales CSV",      href: exportApi.salesCsv("",""), color: "btn-secondary" },
            { label: "PDF Report",     href: exportApi.reportPdf(),     color: "btn-primary"   },
          ].map(({ label, href, color }) => (
            <a key={label} href={href} download className={`${color} justify-center`}>
              <Download size={14} /> {label}
            </a>
          ))}
        </div>
      </div>

      {/* Kaggle links */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-700 mb-3">Recommended Kaggle Datasets</h2>
        <div className="space-y-2">
          {[
            { name: "Supermarket Sales Dataset",          url: "https://www.kaggle.com/datasets/aungpyaeap/supermarket-sales" },
            { name: "Retail Store Inventory Forecasting", url: "https://www.kaggle.com/datasets/anirudhchauhan/retail-store-inventory-forecasting-dataset" },
            { name: "Online Retail II UCI",               url: "https://www.kaggle.com/datasets/mashlyn/online-retail-ii-uci" },
          ].map(({ name, url }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              <FileText size={15} className="flex-shrink-0" />
              {name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
