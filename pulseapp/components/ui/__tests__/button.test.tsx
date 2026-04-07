import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('<Button />', () => {
  it('children içeriğini render eder', () => {
    render(<Button>Kaydet</Button>)
    expect(screen.getByRole('button', { name: /kaydet/i })).toBeInTheDocument()
  })

  it('data-slot="button" attribute içerir', () => {
    render(<Button>Test</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-slot', 'button')
  })

  it('default variant primary class içerir', () => {
    render(<Button>Default</Button>)
    expect(screen.getByRole('button').className).toContain('bg-primary')
  })

  it('destructive variant doğru class kullanır', () => {
    render(<Button variant="destructive">Sil</Button>)
    expect(screen.getByRole('button').className).toContain('bg-destructive/10')
  })

  it('outline variant bg-background class içerir', () => {
    render(<Button variant="outline">Outline</Button>)
    expect(screen.getByRole('button').className).toContain('bg-background')
  })

  it('size="sm" yüksekliği h-7 olarak ayarlar', () => {
    render(<Button size="sm">Küçük</Button>)
    expect(screen.getByRole('button').className).toContain('h-7')
  })

  it('onClick callback tetiklenir', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Tıkla</Button>)

    await userEvent.click(screen.getByRole('button', { name: /tıkla/i }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('disabled prop ile pointer-events kapanır', () => {
    render(<Button disabled>Pasif</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn.className).toContain('disabled:pointer-events-none')
  })

  it('disabled iken onClick tetiklenmez', async () => {
    const handleClick = vi.fn()
    render(
      <Button disabled onClick={handleClick}>
        Pasif
      </Button>
    )
    await userEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('custom className merge edilir', () => {
    render(<Button className="custom-extra">Custom</Button>)
    expect(screen.getByRole('button').className).toContain('custom-extra')
  })
})
