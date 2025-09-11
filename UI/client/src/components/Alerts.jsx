const Alerts = ({ alerts, onRefresh }) => {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
      <div className="flex justify-between items-center">
        <h3 className="text-yellow-700 font-semibold">Alerts</h3>
        <button
          onClick={onRefresh}
          className="text-yellow-700 hover:text-yellow-900 text-sm"
          title="Refresh Alerts"
        >
          Refresh
        </button>
      </div>
      <ul className="mt-2 space-y-2">
        {alerts.map((alert, index) => (
          <li
            key={index}
            className={`p-2 rounded-md ${
              alert.type === "error"
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            <p>{alert.message}</p>
            <p className="text-xs text-gray-600">
              {new Date(alert.timestamp).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Alerts;
