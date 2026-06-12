// SIGMA — Mobile host root: device frame + app on a neutral canvas
const { AndroidDevice: AndroidDeviceX, MobileApp: MobileAppX } = window;

function MobileRoot() {
  return (
    <div className="m-stage">
      <div className="m-stage-label"><span className="dot" /> SIGMA Campo — PWA do agente · protótipo interativo</div>
      <AndroidDeviceX width={392} height={812}>
        <MobileAppX />
      </AndroidDeviceX>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<MobileRoot />);
