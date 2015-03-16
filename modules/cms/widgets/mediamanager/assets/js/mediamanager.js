/*
 * Media manager control class
 *
 * Dependences:
 * - Scrollbar (october.scrollbar.js)
 */
+function ($) { "use strict";

    // MEDIA MANAGER CLASS DEFINITION
    // ============================

    var MediaManager = function(element, options) {
        this.$el = $(element)
        this.$form = this.$el.closest('form')

        this.options = options

        // Event handlers
        this.navigateHandler = this.onNavigate.bind(this)
        this.commandClickHandler = this.onCommandClick.bind(this)
        this.itemClickHandler = this.onItemClick.bind(this)
        this.listMouseDownHandler = this.onListMouseDown.bind(this)
        this.listMouseUpHandler = this.onListMouseUp.bind(this)
        this.listMouseMoveHandler = this.onListMouseMove.bind(this)

        // Instance-bound methods
        this.updateSidebarPreviewBound = this.updateSidebarPreview.bind(this)
        this.replacePlaceholderBound = this.replacePlaceholder.bind(this)
        this.placeholdersUpdatedBound = this.placeholdersUpdated.bind(this)
        this.afterNavigateBound = this.afterNavigate.bind(this)
        this.releaseSidebarThumbnailAjaxBound = this.releaseSidebarThumbnailAjax.bind(this)
        this.replaceSidebarPlaceholderBound = this.replaceSidebarPlaceholder.bind(this)
        this.uploadFileAddedBound = this.uploadFileAdded.bind(this)
        this.uploadUpdateTotalProgressBound = this.uploadUpdateTotalProgress.bind(this)
        this.uploadQueueCompleteBound = this.uploadQueueComplete.bind(this)
        this.uploadSendingBound = this.uploadSending.bind(this)
        this.uploadErrorBound = this.uploadError.bind(this)

        // State properties
        this.selectTimer = null
        this.sidebarPreviewElement = null
        this.itemListElement = null
        this.thumbnailQueue = []
        this.activeThumbnailQueueLength = 0
        this.sidebarThumbnailAjax = null
        this.selectionMarker = null
        this.dropzone = null

        //
        // Initialization
        //

        this.init()
    }

    MediaManager.prototype.dispose = function() {
        this.unregisterHandlers()
        this.clearSelectTimer()
        this.disableUploader()

        this.$el = null
        this.$form = null
        this.updateSidebarPreviewBound = null
        this.replacePlaceholderBound = null
        this.placeholdersUpdatedBound = null
        this.afterNavigateBound = null
        this.replaceSidebarPlaceholderBound = null
        this.uploadFileAddedBound = null
        this.releaseSidebarThumbnailAjaxBound = null
        this.uploadUpdateTotalProgressBound = null
        this.uploadQueueCompleteBound = null
        this.uploadSendingBound = null
        this.uploadErrorBound = null

        this.sidebarPreviewElement = null
        this.itemListElement = null
        this.sidebarThumbnailAjax = null
        this.selectionMarker = null
        this.thumbnailQueue = []
    }

    // MEDIA MANAGER INTERNAL METHODS
    // ============================

    MediaManager.prototype.init = function() {
        this.itemListElement = this.$el.find('[data-control="item-list"]').get(0)
        this.registerHandlers()

        this.updateSidebarPreview()
        this.generateThumbnails()
        this.initUploader()
    }

    MediaManager.prototype.registerHandlers = function() {
        this.$el.on('dblclick', this.navigateHandler)
        this.$el.on('click.tree-path', 'ul.tree-path', this.navigateHandler)
        this.$el.on('click.command', '[data-command]', this.commandClickHandler)
        this.$el.on('click.item', '[data-type="media-item"]', this.itemClickHandler)

        if (this.itemListElement)
            this.itemListElement.addEventListener('mousedown', this.listMouseDownHandler)
    }

    MediaManager.prototype.unregisterHandlers = function() {
        this.$el.off('dblclick', this.navigateHandler)
        this.$el.off('click.tree-path', this.navigateHandler)
        this.$el.off('click.command', this.commandClickHandler)
        this.$el.off('click.item', this.itemClickHandler)

        if (this.itemListElement) {
            this.itemListElement.removeEventListener('mousedown', this.listMouseDownHandler)
            this.itemListElement.removeEventListener('mousemove', this.listMouseMoveHandler)
        }
        document.removeEventListener('mouseup', this.listMouseUpHandler)

        this.navigateHandler = null
        this.commandClickHandler = null
        this.itemClickHandler = null
        this.listMouseDownHandler = null
        this.listMouseUpHandler = null
        this.listMouseMoveHandler = null
    }

    MediaManager.prototype.changeView = function(view) {
        $.oc.stripeLoadIndicator.show()

        var data = {
            view: view,
            path: this.$el.find('[data-type="current-folder"]').val()
        }

        this.$form.request(this.options.alias+'::onChangeView', {
            data: data
        }).always(function() {
            $.oc.stripeLoadIndicator.hide()
        }).done(this.afterNavigateBound)
    }

    //
    // Selecting
    //

    MediaManager.prototype.clearSelectTimer = function() {
        if (this.selectTimer == null)
            return

        clearTimeout(this.selectTimer)
        this.selectTimer = null
    }

    MediaManager.prototype.selectItem = function(node, expandSelection) {
        if (!expandSelection) {
            var items = this.$el.get(0).querySelectorAll('[data-type="media-item"].selected')

            // The class attribute is used only for selecting, it's safe to clear it
            for (var i = 0, len = items.length; i < len; i++)
                items[i].setAttribute('class', '')
        }

        if (!expandSelection)
            node.setAttribute('class', 'selected')
        else {
            if (node.getAttribute('class') == 'selected') 
                node.setAttribute('class', '')
            else
                node.setAttribute('class', 'selected')
        }

        this.clearSelectTimer()

        if (this.isPreviewSidebarVisible()) {
            // Use the timeout to prevent too many AJAX requests
            // when the selection changes too quickly (with the keyboard arrows)
            this.selectTimer = setTimeout(this.updateSidebarPreviewBound, 100) 
        }
    }

    //
    // Navigation
    //

    MediaManager.prototype.gotoFolder = function(path, clearCache) {
        var data = {
                path: path
            }

        if (clearCache)
            data.clearCache = true

        $.oc.stripeLoadIndicator.show()
        this.$form.request(this.options.alias+'::onGoToFolder', {
            data: data
        }).always(function() {
            $.oc.stripeLoadIndicator.hide()
        }).done(this.afterNavigateBound)
    }

    MediaManager.prototype.afterNavigate = function() {
        this.generateThumbnails()
        this.updateSidebarPreview(true)
    }

    MediaManager.prototype.refresh = function() {
        this.gotoFolder(
            this.$el.find('[data-type="current-folder"]').val(),
            true
        )
    }

    //
    // Sidebar
    //

    MediaManager.prototype.isPreviewSidebarVisible = function() {
        return true
    }

    MediaManager.prototype.updateSidebarMediaPreview = function(items) {
        var previewPanel = this.sidebarPreviewElement,
            previewContainer = previewPanel.querySelector('[data-control="media-preview-container"]'),
            template = ''

        for (var i = 0, len = previewContainer.children.length; i < len; i++)
            previewContainer.removeChild(previewContainer.children[i])

        if (items.length == 1) {
            var item = items[0],
                documentType = item.getAttribute('data-document-type')

            switch (documentType) {
                case 'audio' :
                    template = previewPanel.querySelector('[data-control="audio-template"]').innerHTML
                break;
                case 'video' :
                    template = previewPanel.querySelector('[data-control="video-template"]').innerHTML
                break;
                case 'image' :
                    template = previewPanel.querySelector('[data-control="image-template"]').innerHTML
                break;
            }

            previewContainer.innerHTML = template
                .replace('{src}', item.getAttribute('data-public-url'))
                .replace('{path}', item.getAttribute('data-path'))
                .replace('{last-modified}', item.getAttribute('data-last-modified-ts'))

            if (documentType == 'image')
                this.loadSidebarThumbnail()
        }
        else if (items.length == 0) {
            template = previewPanel.querySelector('[data-control="no-selection-template"]').innerHTML
            previewContainer.innerHTML = template
        }
        else  {
            template = previewPanel.querySelector('[data-control="multi-selection-template"]').innerHTML
            previewContainer.innerHTML = template
        }
    }

    MediaManager.prototype.updateSidebarPreview = function(resetSidebar) {
        if (!this.sidebarPreviewElement)
            this.sidebarPreviewElement = this.$el.get(0).querySelector('[data-control="preview-sidebar"]')

        var items = resetSidebar === undefined ? this.$el.get(0).querySelectorAll('[data-type="media-item"].selected') : [],
            previewPanel = this.sidebarPreviewElement

        if (items.length == 0) {
            // No items are selected
            this.sidebarPreviewElement.querySelector('[data-control="sidebar-labels"]').setAttribute('class', 'hide')
        } 
        else if (items.length == 1) {
            this.sidebarPreviewElement.querySelector('[data-control="sidebar-labels"]').setAttribute('class', 'panel')

            // One item is selected - display the details
            var item = items[0]

            previewPanel.querySelector('[data-label="size"]').textContent = item.getAttribute('data-size')
            previewPanel.querySelector('[data-label="title"]').textContent = item.getAttribute('data-title')
            previewPanel.querySelector('[data-label="last-modified"]').textContent = item.getAttribute('data-last-modified')
            previewPanel.querySelector('[data-label="public-url"]').setAttribute('href', item.getAttribute('data-public-url'))
        }
        else {
            // Multiple items are selected
            this.sidebarPreviewElement.querySelector('[data-control="sidebar-labels"]').setAttribute('class', 'hide')
        }

        this.updateSidebarMediaPreview(items)
    }

    MediaManager.prototype.loadSidebarThumbnail = function() {
        if (this.sidebarThumbnailAjax) {
            try {
                this.sidebarThumbnailAjax.abort()
            }
            catch (e) {}
            this.sidebarThumbnailAjax = null
        }

        var sidebarThumbnail = this.sidebarPreviewElement.querySelector('[data-control="sidebar-thumbnail"]')
        if (!sidebarThumbnail)
            return

        var data = {
            path: sidebarThumbnail.getAttribute('data-path'),
            lastModified: sidebarThumbnail.getAttribute('data-last-modified')
        }

        this.sidebarThumbnailAjax = this.$form.request(this.options.alias+'::onGetSidebarThumbnail', {
            data: data
        })
            .done(this.replaceSidebarPlaceholderBound)
            .always(this.releaseSidebarThumbnailAjaxBound)
    }

    MediaManager.prototype.replaceSidebarPlaceholder = function(response) {
        var sidebarThumbnail = this.sidebarPreviewElement.querySelector('[data-control="sidebar-thumbnail"]')
        if (!sidebarThumbnail)
            return

        if (!response.markup)
            return

        sidebarThumbnail.innerHTML = response.markup
        sidebarThumbnail.removeAttribute('data-loading')
    }

    MediaManager.prototype.releaseSidebarThumbnailAjax = function() {
        this.sidebarThumbnailAjax = null
    }

    //
    // Thumbnails
    //

    MediaManager.prototype.generateThumbnails = function() {
        this.thumbnailQueue = []

        var placeholders = this.itemListElement.querySelectorAll('[data-type="media-item"] div.image-placeholder')
        for (var i = (placeholders.length-1); i >= 0; i--)
            this.thumbnailQueue.push({
                id: placeholders[i].getAttribute('id'),
                width: placeholders[i].getAttribute('data-width'), 
                height: placeholders[i].getAttribute('data-height'), 
                path: placeholders[i].getAttribute('data-path'),
                lastModified: placeholders[i].getAttribute('data-last-modified')
            })

        this.handleThumbnailQueue()
    }

    MediaManager.prototype.handleThumbnailQueue = function() {
        var maxThumbnailQueueLength = 2,
            maxThumbnailBatchLength = 3

        if (this.activeThumbnailQueueLength >= maxThumbnailQueueLength)
            return

        for (var i = this.activeThumbnailQueueLength; i < maxThumbnailQueueLength && this.thumbnailQueue.length > 0; i++) {
            var batch = []

            for (var j = 0; j < maxThumbnailBatchLength && this.thumbnailQueue.length > 0; j++)
                batch.push(this.thumbnailQueue.pop())

            this.activeThumbnailQueueLength++

            this.handleThumbnailBatch(batch).always(this.placeholdersUpdatedBound)
        }
    }

    MediaManager.prototype.handleThumbnailBatch = function(batch) {
        var data = {
            batch: batch
        }

        for (var i = 0, len = batch.length; i < len; i++) {
            var placeholder = document.getElementById(batch[i].id)
            if (placeholder)
                placeholder.setAttribute('data-loading', 'true')
        }

        var promise = this.$form.request(this.options.alias+'::onGenerateThumbnails', {
            data: data
        })

        promise.done(this.replacePlaceholderBound)

        return promise
    }

    MediaManager.prototype.replacePlaceholder = function(response) {
        if (!response.generatedThumbnails)
            return

        for (var i = 0, len = response.generatedThumbnails.length; i < len; i++) {
            var thumbnailInfo = response.generatedThumbnails[i]

            if (!thumbnailInfo.id || !thumbnailInfo.markup)
                continue

            var node = document.getElementById(thumbnailInfo.id)
            if (!node)
                continue

            var placeholderContainer = node.parentNode
            if (placeholderContainer)
                placeholderContainer.innerHTML = thumbnailInfo.markup
        }
    }

    MediaManager.prototype.placeholdersUpdated = function() {
        this.activeThumbnailQueueLength--

        this.handleThumbnailQueue()
    }

    //
    // Drag-select
    //

    MediaManager.prototype.getAbsolutePosition = function(element) {
        // TODO: refactor to a core library

        var top = document.body.scrollTop,
            left = 0

        do {
            top += element.offsetTop || 0;
            top -= element.scrollTop || 0;
            left += element.offsetLeft || 0;
            element = element.offsetParent;
        } while(element)

        return {
            top: top,
            left: left
        }
    }

    MediaManager.prototype.getEventPagePosition = function(ev) {
        // TODO: refactor to a core library

        if (ev.pageX || ev.pageY) {
            return {
                x: ev.pageX,
                y: ev.pageY
            }
        }
        else if (ev.clientX || ev.clientY) {
            return {
                x: (ev.clientX + document.body.scrollLeft + document.documentElement.scrollLeft),
                y: (ev.clientY + document.body.scrollTop + document.documentElement.scrollTop)
            }
        }

        return {
            x: 0,
            y: 0
        }
    }

    MediaManager.prototype.getRelativePosition = function(element, pageX, pageY) {
        var absolutePosition = this.getAbsolutePosition(element)

        return {
            x: (pageX - absolutePosition.left),
            y: (pageY - absolutePosition.top)
        }
    }

    MediaManager.prototype.createSelectionMarker = function() {
        if (this.selectionMarker)
            return

        this.selectionMarker = document.createElement('div')
        this.selectionMarker.setAttribute('data-control', 'selection-marker')

        this.itemListElement.insertBefore(this.selectionMarker, this.itemListElement.firstChild)
    }

    MediaManager.prototype.doObjectsCollide = function(aTop, aLeft, aWidth, aHeight, bTop, bLeft, bWidth, bHeight) {
        return !(
            ((aTop + aHeight) < (bTop)) ||
            (aTop > (bTop + bHeight)) ||
            ((aLeft + aWidth) < bLeft) ||
            (aLeft > (bLeft + bWidth))
        )
    }

    //
    // Uploading
    //

    MediaManager.prototype.initUploader = function() {
        if (!this.itemListElement)
            return

        var uploaderOptions = {
            clickable: this.$el.find('[data-control="upload"]').get(0),
            method: 'POST',
            url: window.location,
            paramName: 'file_data',
            createImageThumbnails: false
            // fallback: implement method that would set a flag that the uploader is not supported by the browser
        }

        this.dropzone = new Dropzone(this.$el.get(0), uploaderOptions)
        this.dropzone.on('addedfile', this.uploadFileAddedBound)
        this.dropzone.on('totaluploadprogress', this.uploadUpdateTotalProgressBound)
        this.dropzone.on('queuecomplete', this.uploadQueueCompleteBound)
        this.dropzone.on('sending', this.uploadSendingBound)
        this.dropzone.on('error', this.uploadErrorBound)
    }

    MediaManager.prototype.disableUploader = function() {
        if (!this.dropzone)
            return

        this.dropzone.disable()
        this.dropzone = null
    }

    MediaManager.prototype.uploadFileAdded = function() {
        this.showUploadUi()
        this.setUploadProgress(0)

        this.$el.find('[data-command="cancel-uploading"]').removeClass('hide')
        this.$el.find('[data-command="close-uploader"]').addClass('hide')
    }

    MediaManager.prototype.showUploadUi = function() {
        this.$el.find('[data-control="upload-ui"]').removeClass('hide')
    }

    MediaManager.prototype.hideUploadUi = function() {
        this.$el.find('[data-control="upload-ui"]').addClass('hide')
    }

    MediaManager.prototype.uploadUpdateTotalProgress = function(uploadProgress, totalBytes, totalBytesSent) {
        this.setUploadProgress(uploadProgress)

        var fileNumberLabel = this.$el.get(0).querySelector('[data-label="file-number-and-progress"]'),
            messageTemplate = fileNumberLabel.getAttribute('data-message-template'),
            fileNumber = this.dropzone.getUploadingFiles().length + this.dropzone.getQueuedFiles().length

        // Don't confuse users with displaying 100% 
        // until the operation finishes. We consider the operation
        // finished when the Dropzone's 'compete' event triggers - 
        // when the response is received from the server.
        if (uploadProgress >= 100)
            uploadProgress = 99

        fileNumberLabel.innerHTML = messageTemplate.replace(':number', fileNumber).replace(':percents', Math.round(uploadProgress) + '%')
    }

    MediaManager.prototype.setUploadProgress = function(value) {
        var progresBar = this.$el.get(0).querySelector('[data-control="upload-progress-bar"]')
        
        progresBar.setAttribute('style', 'width: ' + value + '%')
        progresBar.setAttribute('class', 'progress-bar')
    }

    MediaManager.prototype.uploadQueueComplete = function() {
        var fileNumberLabel = this.$el.get(0).querySelector('[data-label="file-number-and-progress"]'),
            completeTemplate = fileNumberLabel.getAttribute('data-complete-template'),
            progresBar = this.$el.get(0).querySelector('[data-control="upload-progress-bar"]')

        fileNumberLabel.innerHTML = completeTemplate;
        progresBar.setAttribute('class', 'progress-bar progress-bar-success')

        this.$el.find('[data-command="cancel-uploading"]').addClass('hide')
        this.$el.find('[data-command="close-uploader"]').removeClass('hide')

        this.refresh()
    }

    MediaManager.prototype.uploadSending = function(file, xhr, formData) {
        formData.append('path', this.$el.find('[data-type="current-folder"]').val())
    }

    MediaManager.prototype.uploadCancelAll = function() {
        this.dropzone.removeAllFiles(true)
        this.hideUploadUi()
    }

    MediaManager.prototype.uploadError = function(file, message) {
        swal({
            title: 'Error uploading file',
            text: message,
            // type: 'error',
            confirmButtonClass: 'btn-default'
        })
    }

    // EVENT HANDLERS
    // ============================

    MediaManager.prototype.onNavigate = function(ev) {
        var $item = $(ev.target).closest('[data-type="media-item"]')

        if (!$item.length || !$item.data('path').length)
            return

        if ($item.data('item-type') == 'folder')
            this.gotoFolder($item.data('path'))

        return false
    }

    MediaManager.prototype.onCommandClick = function(ev) {
        var command = $(ev.currentTarget).data('command')

        switch (command) {
            case 'refresh' : 
                this.refresh()
            break;
            case 'change-view' :
                this.changeView($(ev.target).data('view'))
            break;
            case 'cancel-uploading' :
                this.uploadCancelAll()
            break;
            case 'close-uploader':
                this.hideUploadUi()
            break;
        }

        return false
    }

    MediaManager.prototype.onItemClick = function(ev) {
        if (ev.currentTarget.hasAttribute('data-root'))
            return

        this.selectItem(ev.currentTarget, ev.shiftKey)
    }

    MediaManager.prototype.onListMouseDown = function(ev) {
        this.itemListElement.addEventListener('mousemove', this.listMouseMoveHandler)
        document.addEventListener('mouseup', this.listMouseUpHandler)

        var pagePosition = this.getEventPagePosition(ev),
            relativePosition = this.getRelativePosition(this.itemListElement, pagePosition.x, pagePosition.y)

        this.selectionStartPoint = relativePosition
        this.selectionStarted = false
    }

    MediaManager.prototype.onListMouseUp = function(ev) {
        this.itemListElement.removeEventListener('mousemove', this.listMouseMoveHandler)
        document.removeEventListener('mouseup', this.listMouseUpHandler)
        $(document.body).removeClass('no-select')

        if (this.selectionStarted) {
            var items = this.itemListElement.querySelectorAll('[data-type="media-item"]:not([data-root])'),
                selectionPosition = this.getAbsolutePosition(this.selectionMarker)

            for (var index = 0, len = items.length; index < len; index++) {
                var item = items[index],
                    itemPosition = this.getAbsolutePosition(item)

                if (this.doObjectsCollide(
                        selectionPosition.top,
                        selectionPosition.left,
                        this.selectionMarker.offsetWidth,
                        this.selectionMarker.offsetHeight,
                        itemPosition.top,
                        itemPosition.left,
                        item.offsetWidth,
                        item.offsetHeight)
                ) {
                    if (!ev.shiftKey)
                        item.setAttribute('class', 'selected')
                    else {
                        if (item.getAttribute('class') == 'selected') 
                            item.setAttribute('class', '')
                        else
                            item.setAttribute('class', 'selected')
                    }
                }
                else if (!ev.shiftKey)
                    item.setAttribute('class', '')
            }

            this.updateSidebarPreview()
            this.selectionMarker.setAttribute('class', 'hide')
        }

        this.selectionStarted = false
    }

    MediaManager.prototype.onListMouseMove = function(ev) {
        var pagePosition = this.getEventPagePosition(ev),
            relativePosition = this.getRelativePosition(this.itemListElement, pagePosition.x, pagePosition.y)

        var deltaX = relativePosition.x - this.selectionStartPoint.x,
            deltaY = relativePosition.y - this.selectionStartPoint.y

        if (!this.selectionStarted && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
            // Start processing the selection only if the mouse was moved by 
            // at least 2 pixels.
            this.createSelectionMarker()

            this.selectionMarker.setAttribute('class', '')
            this.selectionStarted = true
            $(document.body).addClass('no-select')
        }

        if (this.selectionStarted) {
            if (deltaX >= 0) {
                this.selectionMarker.style.left = this.selectionStartPoint.x + 'px' 
                this.selectionMarker.style.width = deltaX + 'px' 
            }
            else {
                this.selectionMarker.style.left = relativePosition.x + 'px' 
                this.selectionMarker.style.width = Math.abs(deltaX) + 'px' 
            }

            if (deltaY >= 0) {
                this.selectionMarker.style.height = deltaY + 'px' 
                this.selectionMarker.style.top = this.selectionStartPoint.y + 'px'
            }
            else {
                this.selectionMarker.style.top = relativePosition.y + 'px' 
                this.selectionMarker.style.height = Math.abs(deltaY) + 'px'
            }
        }
    }

    // MEDIA MANAGER PLUGIN DEFINITION
    // ============================

    MediaManager.DEFAULTS = {
        alias: ''
    }

    var old = $.fn.mediaManager

    $.fn.mediaManager = function (option) {
        var args = Array.prototype.slice.call(arguments, 1), 
            result = undefined

        this.each(function () {
            var $this   = $(this)
            var data    = $this.data('oc.mediaManager')
            var options = $.extend({}, MediaManager.DEFAULTS, $this.data(), typeof option == 'object' && option)
            if (!data) $this.data('oc.mediaManager', (data = new MediaManager(this, options)))
            if (typeof option == 'string') result = data[option].apply(data, args)
            if (typeof result != 'undefined') return false
        })
        
        return result ? result : this
    }

    $.fn.mediaManager.Constructor = MediaManager

    // MEDIA MANAGER NO CONFLICT
    // =================

    $.fn.mediaManager.noConflict = function () {
        $.fn.mediaManager = old
        return this
    }

    // MEDIA MANAGER DATA-API
    // ===============

    $(document).on('render', function(){
        $('div[data-control=media-manager]').mediaManager()
    })

}(window.jQuery);