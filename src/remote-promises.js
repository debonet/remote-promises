"use strict";

const SocketIO = require( "socket.io" );
const SocketIOClient = require( "socket.io-client" );
const UUID = require( "uuid" );
const { D, I, E } = require ( "@debonet/bugout" );

	
// ===========================================================================
// Stash class
// ===========================================================================
class Stash {
	constructor(){
		this.gax = {};
	}
	
	fidStash( x, id = undefined ){
		id ??= UUID.v4();
		this.gax[ id ] = x;
		return id;
	}

	fxRead( id ){
		return this.gax[ id ];
	}
	
	fxRemove( id ){
		if ( ! id in this.gax ){
			// silently allow a miss
			return undefined;
		}
		else{
			const x = this.gax[ id ];
			delete this.gax[ id ];
			return x;
		}
	}

	forEach ( f ){
		for ( const id in this.gax ){
			f( id, this.gax[ id ], this.gax );
		}
	}
}


// ===========================================================================
// Caller class
// ===========================================================================
class RemotePromiseCallerClient {
	// -------------------------------------------------------------------------
	constructor( ...vx ){
		this.socket = SocketIOClient( ...vx );

		this.stashJobs = new Stash();
		this.socket.on( "resolve", fOnCompleted );
		this.socket.on( "reject", fOnFailed );
		this.socket.on( "disconnect", fOnDisconnect );

		const self = this;

		// --------------------------------
		function fOnCompleted( id, x ){
			const a = self.stashJobs.fxRemove( id );
			if ( a ){
				a.fOk( x );
			}
		}
		
		// --------------------------------
		function fOnFailed( id, x ){
			const a = self.stashJobs.fxRemove( id );
			if ( a ){
				a.fErr( x );
			}
		}
		// --------------------------------
		async function fOnDisconnect(){
			if ( self.fReconnect ){
				await self.fReconnect();
			}
			
			self.stashJobs.forEach(( id, a ) => {
				self.socket.emit( "do", id, ...a.vxArgs )
			});
		}
	}
	
	// ---------------------------------------------------------------------------
	fOnReconnect( fReconnect ){
		this.fReconnect = fReconnect;
		return this;
	}

	// ---------------------------------------------------------------------------
	fpCall( ...vxArgs ){
		const self = this;
		return new Promise(( fOk, fErr ) => {
			const id = self.stashJobs.fidStash({ vxArgs, fOk, fErr });
			self.socket.emit( "do", id, ...vxArgs );
		});
	}

	// ---------------------------------------------------------------------------
	fClose( ...vx ){
		this.socket.close( ...vx );
	}

	// ---------------------------------------------------------------------------
	ffpCaller(){
		const fpOut = this.fpCall.bind( this );

		fpOut.onReconnect = this.onReconnect.bind( this );
		fpOut.close = this.close.bind( this );

		return fpOut;
	}
}

// aliases
RemotePromiseCallerClient.prototype.onReconnect = RemotePromiseCallerClient.prototype.fOnReconnect;
RemotePromiseCallerClient.prototype.run = RemotePromiseCallerClient.prototype.fpCall;
RemotePromiseCallerClient.prototype.request = RemotePromiseCallerClient.prototype.fpCall;
RemotePromiseCallerClient.prototype.issue = RemotePromiseCallerClient.prototype.fpCall;
RemotePromiseCallerClient.prototype.close = RemotePromiseCallerClient.prototype.fClose;

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
class RemotePromiseCallerServer {
	io = undefined;
	setidJobsWaiting = new Set();
	stashJobs = new Stash();
	aWorker = {};

	// ---------------------------------------------------------------------------
	constructor( ...vx ){
		this.io = SocketIO ( ...vx );

		const self = this;
		
		this.io.on( "connection", ( socket ) => {
			self.fSetupNewProvider( socket );
			self.fHandleJobs();
		});
	}

	// ---------------------------------------------------------------------------
	fSetupNewProvider( socket ){
		socket.on( "resolve", fOnCompleted );
		socket.on( "reject", fOnFailed );
		socket.on( "disconnect", fOnDisconnect );

		const self = this;
		const worker = { socket, tm : 0, setidJobs : new Set(), c : 0 };
		this.aWorker[ socket.id ] = worker;

		// --------------------------------
		function fOnCompleted( id, x ){
			const aJob = self.stashJobs.fxRemove( id );
			worker.setidJobs.delete( id );
			worker.c -= 1;
			if ( aJob ){
				aJob.fOk( x );
			}
		}
		
		// --------------------------------
		function fOnFailed( id, x ){
			const aJob = self.stashJobs.fxRemove( id );
			worker.setidJobs.delete( id );
			worker.c -= 1;
			if ( aJob ){
				aJob.fErr( x );
			}
		}

		// --------------------------------
		async function fOnDisconnect(){
			if ( self.fReconnect ){
				await self.fReconnect();
			}
			
			delete self.aWorker[ socket.id ];
			self.fReissue( worker.setidJobs );
		}
	}

	// ---------------------------------------------------------------------------
	fpCall( ...vxArgs ){
		const self = this;
		return new Promise(( fOk, fErr ) => {
			const id = self.stashJobs.fidStash({ vxArgs, fOk, fErr });
			self.setidJobsWaiting.add( id );
			self.fHandleJobs();
		});
	}

	// ---------------------------------------------------------------------------
	fReissue( setidJobs ){
		for ( const idJob of setidJobs ){
			this.setidJobsWaiting.add( idJob );
		}
		this.fHandleJobs();
	}

	// ---------------------------------------------------------------------------
	fHandleJobs(){
		if ( Object.keys( this.aWorker ).length == 0 ){
			return;
		}

		for ( const idJob of this.setidJobsWaiting ){
			let workerMin = { c: - 1, bNone : false };
			
			for ( const idSocket in this.aWorker ){
				const worker = this.aWorker[ idSocket ];
				if ( worker.c <= workerMin.c || workerMin.c < 0 ){
					workerMin = worker;
				}
			}

			workerMin.c += 1;
			let aJob = this.stashJobs.fxRead( idJob );
			workerMin.socket.emit( "do", idJob, ...aJob.vxArgs );
			workerMin.setidJobs.add( idJob );
			this.setidJobsWaiting.delete( idJob );
		}
	}
	
	// ---------------------------------------------------------------------------
	fOnReconnect( fReconnect ){
		this.fReconnect = fReconnect;
		return this;
	}

	// ---------------------------------------------------------------------------
	fClose( ...vx ){
		this.io.close( ...vx );
	}

	// ---------------------------------------------------------------------------
	ffpCaller(){
		const fpOut = this.fpCall.bind( this );
		
		fpOut.onReconnect = this.onReconnect.bind( this );
		fpOut.close = this.close.bind( this );
		
		return fpOut;
	}
}

// aliases
RemotePromiseCallerServer.prototype.run = RemotePromiseCallerServer.prototype.fpCall;
RemotePromiseCallerServer.prototype.request = RemotePromiseCallerServer.prototype.fpCall;
RemotePromiseCallerServer.prototype.issue = RemotePromiseCallerServer.prototype.fpCall;
RemotePromiseCallerServer.prototype.onReconnect = RemotePromiseCallerServer.prototype.fOnReconnect;
RemotePromiseCallerServer.prototype.close = RemotePromiseCallerServer.prototype.fClose;



// ===========================================================================
// Function Runner classes
// ===========================================================================

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
class RemotePromiseRunnerBase {

	aSocketForId = {};

	// ------------------------------------
	constructor( socket, fp ){
		const self = this;
		
		socket.on( "do", ( id, ...vx ) => {
			const b = id in self.aSocketForId;
			
			self.aSocketForId[ id ] = socket;

			if ( ! b ){
				self.fOnExecute( self.aSocketForId[ id ], id, fp, vx );
			}
		});
	}

	fOnExecute( socket, id, fp, vx ){
		return Promise.resolve( fp( ...vx ))
			.then(( x ) => socket.emit( "resolve", id, x ))
			.catch(( x ) => socket.emit( "reject", id, x ))
			.finally(() => delete this.aSocketForId[ id ]);
	}
	
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
class RemotePromiseRunnerServer {

	io = undefined;

	// ------------------------------------
	constructor( fp, ...vx ){
		this.io = SocketIO ( ...vx );
		const self = this;
		this.io.on( "connection", ( socket ) => {
			return self.fRunnerBase( socket, fp );
		});
	}

	// ------------------------------------
	fRunnerBase ( socket, fp ){
		return new RemotePromiseRunnerBase( socket, fp );
	}

	// ------------------------------------
	fClose( ...vx ){
		this.io.close( ...vx );
	}
}

// aliases
RemotePromiseRunnerServer.prototype.close = RemotePromiseRunnerServer.prototype.fClose;

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
class RemotePromiseRunnerClient extends RemotePromiseRunnerBase {
	constructor( fp, ...vx ){
		const socket = SocketIOClient ( ...vx )
		super ( socket , fp );
		this.socket = socket;
	}
	// ------------------------------------
	fClose( ...vx ){
		this.socket.close( ...vx );
	}
}

// aliases
RemotePromiseRunnerClient.prototype.close = RemotePromiseRunnerClient.prototype.fClose;


// ===========================================================================
// Construction functions
//   these hide the underling class machinery for easy use
// ===========================================================================

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
function ffpCallerClient( ...vx ){
	return ( new RemotePromiseCallerClient( ...vx )).ffpCaller();
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
function ffpCallerServer( ...vx ){
	return ( new RemotePromiseCallerServer( ...vx )).ffpCaller();
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
function frpRunnerServer( ...vx ){
	return new RemotePromiseRunnerServer( ...vx );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
function frpRunnerClient( ...vx ){
	return new RemotePromiseRunnerClient( ...vx );
}



// ===========================================================================
// exports
// ===========================================================================
module.exports = {
	// conventional naming -------------------------
	
	// typical usage 
	serve : frpRunnerServer,
	client : ffpCallerClient,

	// flipped usage 
	provide : frpRunnerClient,
	marshal : ffpCallerServer,

	
	// explicit naming -------------------------

	// typical usage 
	frpServe : frpRunnerServer,
	ffpClient : ffpCallerClient,

	// flipped usage 
	frpProvide : frpRunnerClient,
	ffpMarshal : ffpCallerServer,

	// explicit names
	ffpCallerServer,
	ffpCallerClient,
	frpRunnerServer,
	frpRunnerClient,

	
	// underlying classes ----------------------
	CallerClient : RemotePromiseCallerClient,
	CallerServer : RemotePromiseCallerServer,
	RunnerBase : RemotePromiseRunnerBase,
	RunnerClient : RemotePromiseRunnerClient,
	RunnerServer : RemotePromiseRunnerServer
}


