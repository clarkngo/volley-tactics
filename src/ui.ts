import { Timeline } from './timeline';
import { ActionPose, Team, EasingType, ACTION_LABELS } from './types';
import { downloadJson, copyShareUrl } from './state';

export class UI {
  private playBtn = document.getElementById('btn-play')!;
  private scrubber = document.getElementById('scrubber') as HTMLInputElement;
  private timeDisplay = document.getElementById('time-display')!;
  private durationInput = document.getElementById('duration-input') as HTMLInputElement;
  private easingSelect = document.getElementById('easing-select') as HTMLSelectElement;
  private keyframeDots = document.getElementById('keyframe-dots')!;
  private sidePanel = document.getElementById('side-panel')!;
  private panelTitle = document.getElementById('panel-title')!;
  private panelTeam = document.getElementById('panel-team')!;
  private panelAction = document.getElementById('panel-action') as HTMLSelectElement;
  private panelX = document.getElementById('panel-x') as HTMLInputElement;
  private panelZ = document.getElementById('panel-z') as HTMLInputElement;
  private panelPlayerSection = document.getElementById('panel-player-section')!;
  private panelBallSection = document.getElementById('panel-ball-section')!;
  private panelBallLabel = document.getElementById('panel-ball-label') as HTMLInputElement;
  private panelBallColor = document.getElementById('panel-ball-color') as HTMLInputElement;
  private toast = document.getElementById('toast')!;
  private fileInput = document.getElementById('file-input') as HTMLInputElement;

  selectedAction: ActionPose = 'receiver';

  onAddPlayer: ((team: Team, action: ActionPose) => void) | null = null;
  onAddBallPath: (() => void) | null = null;
  onKeyframe: (() => void) | null = null;
  onDelete: (() => void) | null = null;
  onActionChange: ((action: ActionPose) => void) | null = null;
  onPositionChange: ((x: number, z: number) => void) | null = null;
  onBallLabelChange: ((label: string) => void) | null = null;
  onBallColorChange: ((color: number) => void) | null = null;
  onSeek: ((time: number) => void) | null = null;
  onSpeedChange: ((speed: number) => void) | null = null;
  onEasingChange: ((easing: EasingType) => void) | null = null;
  onDurationChange: ((duration: number) => void) | null = null;
  onCameraPreset: ((preset: string) => void) | null = null;
  onLoad: ((json: string) => void) | null = null;

  constructor(private timeline: Timeline) {
    this.bindEvents();
    this.timeline.onTimeUpdate = (t) => this.updateTimeDisplay(t);
    this.timeline.onPlayStateChange = (playing) => this.updatePlayButton(playing);
    this.easingSelect.value = this.timeline.easing;
  }

  private bindEvents(): void {
    document.querySelectorAll('.action-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.action-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedAction = (btn as HTMLElement).dataset.action as ActionPose;
        if (this.selectedPlayerId) {
          this.onActionChange?.(this.selectedAction);
        }
      });
    });

    document.getElementById('btn-add-team-a')!.addEventListener('click', () => {
      this.onAddPlayer?.('A', this.selectedAction);
    });
    document.getElementById('btn-add-team-b')!.addEventListener('click', () => {
      this.onAddPlayer?.('B', this.selectedAction);
    });
    document.getElementById('btn-add-ball')!.addEventListener('click', () => {
      this.onAddBallPath?.();
    });
    document.getElementById('btn-keyframe')!.addEventListener('click', () => {
      this.onKeyframe?.();
      this.showToast('Keyframe at ' + this.timeline.currentTime.toFixed(1) + 's');
      this.renderKeyframeDots();
    });

    document.getElementById('btn-save')!.addEventListener('click', () => {
      downloadJson(this.timeline.toState());
      this.showToast('Saved play.json');
    });
    document.getElementById('btn-load')!.addEventListener('click', () => {
      this.fileInput.click();
    });
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.onLoad?.(reader.result as string);
        this.easingSelect.value = this.timeline.easing;
        this.renderKeyframeDots();
        this.showToast('Play loaded');
      };
      reader.readAsText(file);
      this.fileInput.value = '';
    });
    document.getElementById('btn-share')!.addEventListener('click', () => {
      copyShareUrl(this.timeline.toState());
      this.showToast('URL copied!');
    });

    this.playBtn.addEventListener('click', () => this.timeline.toggle());
    this.scrubber.addEventListener('input', () => {
      this.timeline.seekPercent(parseInt(this.scrubber.value));
      this.onSeek?.(this.timeline.currentTime);
    });
    this.durationInput.addEventListener('change', () => {
      const d = parseFloat(this.durationInput.value);
      this.timeline.setDuration(d);
      this.onDurationChange?.(d);
      this.updateTimeDisplay(this.timeline.currentTime);
      this.renderKeyframeDots();
    });

    this.easingSelect.addEventListener('change', () => {
      const easing = this.easingSelect.value as EasingType;
      this.timeline.setEasing(easing);
      this.onEasingChange?.(easing);
    });

    document.querySelectorAll('.speed-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.timeline.setSpeed(parseFloat((btn as HTMLElement).dataset.speed!));
      });
    });

    document.querySelectorAll('.cam-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cam-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.onCameraPreset?.((btn as HTMLElement).dataset.preset!);
      });
    });

    this.panelAction.addEventListener('change', () => {
      this.onActionChange?.(this.panelAction.value as ActionPose);
    });
    this.panelX.addEventListener('change', () => {
      this.onPositionChange?.(parseFloat(this.panelX.value), parseFloat(this.panelZ.value));
    });
    this.panelZ.addEventListener('change', () => {
      this.onPositionChange?.(parseFloat(this.panelX.value), parseFloat(this.panelZ.value));
    });
    this.panelBallLabel.addEventListener('change', () => {
      this.onBallLabelChange?.(this.panelBallLabel.value);
    });
    this.panelBallColor.addEventListener('input', () => {
      this.onBallColorChange?.(parseInt(this.panelBallColor.value.replace('#', ''), 16));
    });
    document.getElementById('btn-delete')!.addEventListener('click', () => {
      this.onDelete?.();
    });
  }

  private selectedPlayerId: string | null = null;

  setSelectedPlayerId(id: string | null): void {
    this.selectedPlayerId = id;
  }

  highlightActionPill(action: ActionPose): void {
    document.querySelectorAll('.action-pill').forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.action === action);
    });
    this.selectedAction = action;
  }

  updateTimeDisplay(time: number): void {
    this.timeDisplay.textContent = time.toFixed(1) + 's';
    this.scrubber.value = String(Math.round((time / this.timeline.duration) * 1000));
  }

  updatePlayButton(playing: boolean): void {
    this.playBtn.textContent = playing ? '⏸' : '▶';
  }

  renderKeyframeDots(): void {
    this.keyframeDots.innerHTML = '';
    const times = new Set<number>();
    this.timeline.players.forEach((p) => p.keyframes.forEach((kf) => times.add(kf.time)));
    this.timeline.ballPaths.forEach((p) => p.keyframes.forEach((kf) => times.add(kf.time)));
    times.forEach((t) => {
      const dot = document.createElement('div');
      dot.className = 'kf-dot';
      dot.style.left = `${(t / this.timeline.duration) * 100}%`;
      this.keyframeDots.appendChild(dot);
    });
  }

  showPlayerPanel(team: Team, action: ActionPose, x: number, z: number): void {
    this.sidePanel.classList.remove('hidden');
    this.panelPlayerSection.classList.remove('hidden');
    this.panelBallSection.classList.add('hidden');
    this.panelTitle.textContent = 'Player';
    this.panelTeam.textContent = team === 'A' ? 'Blue' : 'Red';
    this.panelTeam.className = 'badge team-' + team.toLowerCase();
    this.panelAction.value = action;
    this.panelX.value = x.toFixed(1);
    this.panelZ.value = z.toFixed(1);
    this.highlightActionPill(action);
  }

  showBallPathPanel(label: string, color: number): void {
    this.sidePanel.classList.remove('hidden');
    this.panelPlayerSection.classList.add('hidden');
    this.panelBallSection.classList.remove('hidden');
    this.panelTitle.textContent = 'Ball Path';
    this.panelBallLabel.value = label;
    this.panelBallColor.value = '#' + color.toString(16).padStart(6, '0');
  }

  hidePanel(): void {
    this.sidePanel.classList.add('hidden');
    this.setSelectedPlayerId(null);
  }

  showToast(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.add('hidden'), 2200);
  }

  getActionLabel(action: ActionPose): string {
    return ACTION_LABELS[action];
  }

  private toastTimer: ReturnType<typeof setTimeout> | undefined;
}
