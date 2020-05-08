
const pushee = {
	
	setProps: {},

	socket: null, 

    pending: {}, 

    sendQueue: [],

    requestNum: 0, 

    checkSocket: function() {
        if (pushee.socket===null) {
            console.log('open socket');
            const url = 'ws://' + document.domain + ':' + location.port + '/_push';
            pushee.socket = new WebSocket(url);
            pushee.socket.onmessage = pushee.receive;
            pushee.socket.onopen = pushee.open;
            pushee.socket.onclose = pushee.close;
        }
    },

    checkPending: function() {
        if (Object.keys(pushee.pending).length>50) {
            let min = Number.MAX_SAFE_INTEGER;
            let max = 0;
            for (let index in pushee.pending) {
                index = parseInt(index);
                if (index>max)
                    max = index;
                if (index<min)
                    min = index;
            }
            let midway = (min + max)/2;
            for (const index in pushee.pending) {
                if (index<midway)
                    delete pushee.pending[index];
            }
        }
    },

	add: function(props, setProps) {
        pushee.checkSocket();
		// add to table
		pushee.setProps[props.id] = setProps;	
	},

	receive: function(event) {
        const data = JSON.parse(event.data)
        if (data.id==='mod')
            pushee.update(data.data, false);
        else if (data.id==='mod_n')
            pushee.update(data.data, true);
        else if (data.id in pushee.pending) {
            pushee.pending[data.id](data.data);
            delete pushee.pending[data.id];
        }
    },	

    send: function(data) {
        pushee.checkSocket();
        if (pushee.socket.readyState===WebSocket.CONNECTING)
            pushee.sendQueue.push(data);
        else 
            pushee.socket.send(JSON.stringify(data));
    },

    request: function(url, data){
        pushee.checkPending();
        const p = new Promise(resolve => pushee.pending[pushee.requestNum] = resolve);
        const d = {id: pushee.requestNum, url: url};
        if (data!==undefined) 
            d['data'] = data;
        pushee.send(d);
        pushee.requestNum++;
        return p;
    },

	close: function(event) {
		console.log('close socket');
		pushee.socket = null;
        pushee.sendQueue = [];
        pushee.pending = {}; 
	},

    open: function(event) {
        for (const data of pushee.sendQueue)
            pushee.socket.send(JSON.stringify(data));
    },

    update: function(data, notify) {
        const ids = Object.keys(data);
        for (const id of ids) {
            if (id in pushee.setProps) {
                const val = data[id];
            	pushee.setProps[id](val, notify, pushee.updatePaths(val));
            }
            else
            	console.log('cannot find ' + id);
        }
    },

    updatePaths: function(val) {
        if (typeof val!=='object')
            return false
        if ('id' in val)
            return true;
        else if (Array.isArray(val)) {
            for (let i=0; i<val.length; i++) {
                if (pushee.updatePaths(val[i]))
                    return true;
            }
        }
        else if ('props' in val)
            return pushee.updatePaths(val.props);
        else if ('children' in val) 
            return pushee.updatePaths(val.children);
        else
            return false;
    },
};


export const services = {
    // Service bits
    // update component, opposite = http update
    PUSHEE_UPDATE: 1<<0, 
    // dependencies, layout, reload_hash, opposite = http requests
    PUSHEE_OTHER: 1<<1,  
    // not supported for server_service, opposite = initial callback from each client
    NO_CLIENT_INITIAL_CALLBACK: 1<<2,
}; 


export function pusheeAdd(props, setProps) {
	pushee.add(props, setProps);
}


export function pusheeRequest(url, data=null) {
    return pushee.request(url, data);   
}