/**
 * 트럭 도면을 PNG로 내려받는다.
 *
 * SVG를 그대로 저장하면 벡터 편집기에서는 좋지만 현장에서 쓰는 건 종이에 붙인
 * 그림이라 2배 확대해 래스터로 굽는다. 종이에 인쇄할 걸 생각해 배경은 투명보다
 * 흰색이 낫다.
 */
export function downloadTruckImage(svg: SVGSVGElement, filename: string) {
  const rect = svg.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const scale = 2 // 인쇄·확대에 견디도록 2배로 그린다

  const computed = getComputedStyle(svg)
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.setAttribute('style', `color: ${computed.color}; font-family: ${computed.fontFamily};`)

  const source = new XMLSerializer().serializeToString(clone)
  const svgUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }))

  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // 종이에 인쇄할 걸 생각하면 배경은 투명보다 흰색이 낫다
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    }
    URL.revokeObjectURL(svgUrl)

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
  image.onerror = () => URL.revokeObjectURL(svgUrl)
  image.src = svgUrl
}