interface MoreMenuProps {
  onMarkAllRead: () => void;
  onSync: () => void;
  onSettings: () => void;
  onDisconnect: () => void;
}

export default function MoreMenu({ onMarkAllRead, onSync, onSettings, onDisconnect }: MoreMenuProps) {
  return (
    <div className="more-menu">
      <button onClick={onMarkAllRead}>Mark all read</button>
      <button onClick={onSync}>Sync now</button>
      <button onClick={onSettings}>Account settings</button>
      <hr />
      <button className="danger" onClick={onDisconnect}>Disconnect</button>
    </div>
  );
}
