(() => {
  'use strict'

  const root = document.documentElement
  const home = document.getElementById('xiexie-home')
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const safeSession = {
    get (key) {
      try { return window.sessionStorage.getItem(key) } catch (_) { return null }
    },
    set (key, value) {
      try { window.sessionStorage.setItem(key, value) } catch (_) {}
    }
  }

  if (home && !reduceMotion && !safeSession.get('xiexie:intro-played')) {
    safeSession.set('xiexie:intro-played', '1')
    root.classList.add('x-intro-active')

    let revealTimer
    let doneTimer
    let finished = false

    const cleanListeners = () => {
      window.removeEventListener('wheel', skipIntro)
      window.removeEventListener('pointerdown', skipIntro)
      window.removeEventListener('touchstart', skipIntro)
      window.removeEventListener('keydown', skipIntro)
    }

    const completeIntro = () => {
      if (finished) return
      finished = true
      window.clearTimeout(revealTimer)
      window.clearTimeout(doneTimer)
      cleanListeners()
      root.classList.remove('x-intro-active', 'x-intro-reveal')
      root.classList.add('x-intro-done')
    }

    const finishIntro = (immediate = false) => {
      if (finished) return
      window.clearTimeout(revealTimer)
      window.clearTimeout(doneTimer)
      root.classList.add('x-intro-reveal')
      doneTimer = window.setTimeout(completeIntro, immediate ? 80 : 620)
    }

    function skipIntro () {
      finishIntro(true)
    }

    revealTimer = window.setTimeout(() => {
      root.classList.add('x-intro-reveal')
      doneTimer = window.setTimeout(completeIntro, 620)
    }, 800)

    window.addEventListener('wheel', skipIntro, { passive: true })
    window.addEventListener('pointerdown', skipIntro, { passive: true })
    window.addEventListener('touchstart', skipIntro, { passive: true })
    window.addEventListener('keydown', skipIntro)
  } else if (home) {
    root.classList.add('x-intro-done')
  }

  const openThemeSearch = () => {
    const searchButton = document.querySelector('#search-button > .search')
    if (searchButton) searchButton.click()
  }

  const homeSearchForm = document.querySelector('[data-home-search]')
  const homeSearchInput = document.getElementById('x-home-search-input')
  const homeSearchResults = document.getElementById('x-home-search-results')
  if (homeSearchForm && homeSearchInput && homeSearchResults) {
    let searchEntriesPromise

    const loadSearchEntries = () => {
      if (searchEntriesPromise) return searchEntriesPromise
      searchEntriesPromise = window.fetch('/search.xml')
        .then(response => response.text())
        .then(xml => {
          const xmlDocument = new DOMParser().parseFromString(xml, 'text/xml')
          return Array.from(xmlDocument.querySelectorAll('entry')).map(entry => {
            const contentHtml = entry.querySelector('content')?.textContent || ''
            const contentDocument = new DOMParser().parseFromString(contentHtml, 'text/html')
            return {
              title: entry.querySelector('title')?.textContent.trim() || '无标题',
              url: entry.querySelector('url')?.textContent.trim() || '#',
              content: (contentDocument.body.textContent || '').replace(/\s+/g, ' ').trim()
            }
          })
        })
      return searchEntriesPromise
    }

    const renderHomeSearchResults = async () => {
      const query = homeSearchInput.value.trim().toLowerCase()
      if (!query) {
        homeSearchResults.hidden = true
        homeSearchResults.replaceChildren()
        return []
      }

      const keywords = query.split(/[-\s]+/).filter(Boolean)
      const entries = await loadSearchEntries()
      const matches = entries
        .map(entry => {
          const title = entry.title.toLowerCase()
          const haystack = `${title} ${entry.content.toLowerCase()}`
          const matched = keywords.filter(keyword => haystack.includes(keyword)).length
          return { ...entry, matched, titleMatch: title.includes(query) }
        })
        .filter(entry => entry.matched === keywords.length)
        .sort((left, right) => Number(right.titleMatch) - Number(left.titleMatch))
        .slice(0, 6)

      homeSearchResults.replaceChildren()
      if (!matches.length) {
        const empty = document.createElement('p')
        empty.className = 'x-home-search-empty'
        empty.textContent = '没有找到相关记录'
        homeSearchResults.append(empty)
      } else {
        matches.forEach(entry => {
          const link = document.createElement('a')
          const title = document.createElement('strong')
          const summary = document.createElement('span')
          link.className = 'x-home-search-result'
          link.href = entry.url
          link.setAttribute('role', 'option')
          title.textContent = entry.title
          summary.textContent = entry.content.slice(0, 72)
          link.append(title, summary)
          homeSearchResults.append(link)
        })
      }
      homeSearchResults.hidden = false
      return matches
    }

    let searchTimer
    homeSearchInput.addEventListener('input', () => {
      window.clearTimeout(searchTimer)
      searchTimer = window.setTimeout(renderHomeSearchResults, 120)
    })
    homeSearchInput.addEventListener('focus', () => {
      if (homeSearchInput.value.trim()) renderHomeSearchResults()
    })
    homeSearchForm.addEventListener('submit', async event => {
      event.preventDefault()
      const matches = await renderHomeSearchResults()
      if (matches[0]) window.location.assign(matches[0].url)
    })
    document.addEventListener('click', event => {
      if (!event.target.closest('.x-home-search-wrap')) homeSearchResults.hidden = true
    })
  }

  window.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      if (homeSearchInput) homeSearchInput.focus()
      else openThemeSearch()
    }
  })

  const postList = document.querySelector('[data-post-list]')
  const postPagination = document.querySelector('[data-post-pagination]')
  if (postList && postPagination) {
    const posts = Array.from(postList.querySelectorAll('[data-post-item]'))
    const pageSize = Number.parseInt(postList.dataset.pageSize, 10) || 6
    const pageCount = Math.ceil(posts.length / pageSize)

    const currentPageFromUrl = () => {
      const value = Number.parseInt(new URL(window.location.href).searchParams.get('post-page'), 10)
      return Number.isFinite(value) ? Math.min(Math.max(value, 1), pageCount) : 1
    }

    const renderPostsPage = (pageNumber, scrollToList = false) => {
      const page = Math.min(Math.max(pageNumber, 1), pageCount)
      const first = (page - 1) * pageSize
      const last = first + pageSize

      posts.forEach((post, index) => {
        const visible = index >= first && index < last
        post.hidden = !visible
        post.setAttribute('aria-hidden', String(!visible))
      })

      postPagination.replaceChildren()
      if (pageCount <= 1) {
        postPagination.hidden = true
        return
      }

      const makeButton = (label, targetPage, options = {}) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = `x-page-button${options.arrow ? ' is-arrow' : ''}`
        button.textContent = label
        button.disabled = Boolean(options.disabled)
        button.setAttribute('aria-label', options.ariaLabel || `第 ${targetPage} 页`)
        if (targetPage === page && !options.arrow) {
          button.classList.add('is-current')
          button.setAttribute('aria-current', 'page')
        }
        button.addEventListener('click', () => {
          const url = new URL(window.location.href)
          if (targetPage === 1) url.searchParams.delete('post-page')
          else url.searchParams.set('post-page', String(targetPage))
          window.history.pushState({}, '', url)
          renderPostsPage(targetPage, true)
        })
        return button
      }

      postPagination.append(makeButton('←', page - 1, {
        arrow: true,
        disabled: page === 1,
        ariaLabel: '上一页'
      }))
      for (let number = 1; number <= pageCount; number += 1) {
        postPagination.append(makeButton(String(number), number))
      }
      postPagination.append(makeButton('→', page + 1, {
        arrow: true,
        disabled: page === pageCount,
        ariaLabel: '下一页'
      }))

      if (scrollToList) {
        document.getElementById('x-latest-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    renderPostsPage(currentPageFromUrl())
    window.addEventListener('popstate', () => renderPostsPage(currentPageFromUrl()))
  }

  const friendsIntro = document.querySelector('.x-friends-intro')
  const friendsRain = document.getElementById('x-friends-rain')
  if (friendsIntro) {
    const skipFriendsIntro = () => root.classList.add('x-friends-intro-skip')
    friendsIntro.addEventListener('pointerdown', skipFriendsIntro, { once: true })
    window.addEventListener('keydown', skipFriendsIntro, { once: true })
  }

  if (friendsRain && !reduceMotion) {
    const context = friendsRain.getContext('2d')
    let width = 0
    let height = 0
    let drops = []
    let splashes = []
    let previousTime = 0

    const makeDrop = (initial = false) => ({
      x: Math.random() * width,
      y: initial ? -Math.random() * height : -24 - Math.random() * 90,
      velocityX: 0.018 + Math.random() * 0.018,
      velocityY: 0.25 + Math.random() * 0.22,
      gravity: 0.00011 + Math.random() * 0.00012,
      length: 18 + Math.random() * 22,
      width: 1.05 + Math.random() * 1.15,
      opacity: 0.18 + Math.random() * 0.18
    })

    const addSplash = drop => {
      const particleCount = 2 + Math.floor(Math.random() * 2)
      for (let index = 0; index < particleCount; index += 1) {
        splashes.push({
          x: drop.x,
          y: height - 2,
          velocityX: -0.07 + Math.random() * 0.14,
          velocityY: -0.12 - Math.random() * 0.12,
          gravity: 0.00042,
          life: 1,
          opacity: drop.opacity * 0.8
        })
      }
      if (splashes.length > 180) splashes.splice(0, splashes.length - 180)
    }

    const resizeRain = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      friendsRain.width = Math.round(width * pixelRatio)
      friendsRain.height = Math.round(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      const dropCount = Math.max(58, Math.min(150, Math.round(width / 7.5)))
      drops = Array.from({ length: dropCount }, () => makeDrop(true))
      splashes = []
    }

    const drawRain = time => {
      const elapsed = Math.min(time - previousTime || 16, 32)
      previousTime = time
      context.clearRect(0, 0, width, height)
      context.lineCap = 'round'

      drops.forEach(drop => {
        drop.velocityY += drop.gravity * elapsed
        drop.y += drop.velocityY * elapsed
        drop.x += drop.velocityX * elapsed

        if (drop.y > height) {
          addSplash(drop)
          Object.assign(drop, makeDrop())
        } else if (drop.x > width + 40) {
          Object.assign(drop, makeDrop())
        }

        context.beginPath()
        context.moveTo(drop.x, drop.y)
        context.lineTo(drop.x + drop.length * 0.075, drop.y + drop.length)
        context.lineWidth = drop.width
        context.strokeStyle = `rgba(218, 239, 249, ${drop.opacity})`
        context.stroke()
      })

      splashes = splashes.filter(particle => {
        particle.velocityY += particle.gravity * elapsed
        particle.x += particle.velocityX * elapsed
        particle.y += particle.velocityY * elapsed
        particle.life -= elapsed / 340
        if (particle.life <= 0) return false

        context.beginPath()
        context.arc(particle.x, particle.y, 0.8 + particle.life, 0, Math.PI * 2)
        context.fillStyle = `rgba(218, 239, 249, ${particle.opacity * particle.life})`
        context.fill()
        return true
      })

      window.requestAnimationFrame(drawRain)
    }

    resizeRain()
    window.addEventListener('resize', resizeRain, { passive: true })
    window.requestAnimationFrame(drawRain)
  }

  const rightside = document.getElementById('rightside')
  const rightsideShow = document.getElementById('rightside-config-show')
  if (rightside && rightsideShow) {
    const toolsButton = document.createElement('button')
    toolsButton.id = 'x-mobile-tools-toggle'
    toolsButton.type = 'button'
    toolsButton.title = '显示页面工具'
    toolsButton.setAttribute('aria-expanded', 'false')
    toolsButton.innerHTML = '<i class="fas fa-ellipsis-h" aria-hidden="true"></i>'
    rightsideShow.insertBefore(toolsButton, rightsideShow.firstChild)

    toolsButton.addEventListener('click', () => {
      const isOpen = rightside.classList.toggle('mobile-tools-open')
      toolsButton.setAttribute('aria-expanded', String(isOpen))
      toolsButton.title = isOpen ? '收起页面工具' : '显示页面工具'
    })
  }

  const syncGiscusLanguage = () => {
    const frame = document.querySelector('#giscus-wrap iframe')
    const translateButton = document.getElementById('translateLink')
    if (!frame || !translateButton) return

    const language = translateButton.textContent.trim() === '简' ? 'zh-TW' : 'zh-CN'
    frame.contentWindow.postMessage({ giscus: { setConfig: { lang: language } } }, 'https://giscus.app')
  }

  const translateButton = document.getElementById('translateLink')
  if (translateButton) {
    translateButton.addEventListener('click', () => window.setTimeout(syncGiscusLanguage, 120))
  }

  const giscusWrap = document.getElementById('giscus-wrap')
  if (giscusWrap) {
    new MutationObserver(syncGiscusLanguage).observe(giscusWrap, { childList: true })
  }
})()
