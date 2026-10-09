import type { PackingScenario } from '../../api/scenarios'

/** 저장된 적재 시나리오 한 줄. 불러오기·수정·삭제·즐겨찾기를 함께 노출한다. */
export default function ScenarioRow({
  scenario,
  onLoad,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  scenario: PackingScenario
  onLoad: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleFavorite: () => void
}) {
  return (
    <div className="dl-scenario">
      <div className="dl-scenario-head">
        <div style={{ minWidth: 0 }}>
          <div className="dl-scenario-name">{scenario.name}</div>
          {scenario.description && <p className="dl-scenario-desc">{scenario.description}</p>}
        </div>
        <button
          className={`dl-star${scenario.isFavorite ? ' is-on' : ''}`}
          onClick={onToggleFavorite}
          title={scenario.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          aria-label={scenario.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          {scenario.isFavorite ? '★' : '☆'}
        </button>
      </div>

      <div className="dl-scenario-meta">
        <span>
          적재함 {scenario.truckWidth} × {scenario.truckHeight} mm
        </span>
        <span>물품 {scenario.items.length}종</span>
        <span>회전 {scenario.allowRotate ? '허용' : '미허용'}</span>
        <span>마진 {scenario.margin}mm</span>
        {scenario.preserveOrder && <span>입력 순서 적재</span>}
      </div>

      <div className="dl-scenario-actions">
        <button className="fl-btn fl-btn-sm" onClick={onEdit}>
          수정
        </button>
        <button className="fl-btn fl-btn-sm fl-btn-danger" onClick={onDelete}>
          삭제
        </button>
        <button className="fl-btn fl-btn-sm fl-btn-primary" onClick={onLoad}>
          불러오기
        </button>
      </div>
    </div>
  )
}